import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Handle an incoming patient message from Gupshup webhook.
   *
   * Gupshup payload format:
   * {
   *   "app": "AppName",
   *   "timestamp": 1718007189549,
   *   "version": 2,
   *   "type": "message",
   *   "payload": {
   *     "id": "ABEGkYaYVSEEAhAL...",
   *     "source": "918x98xx21x4",
   *     "type": "text",
   *     "payload": { "text": "Hello doctor" },
   *     "sender": {
   *       "phone": "918x98xx21x4",
   *       "name": "Patient Name",
   *       "country_code": "91",
   *       "dial_code": "8x98xx21x4"
   *     }
   *   }
   * }
   */
  async handleIncomingMessage(webhookPayload: any) {
    const messagePayload = webhookPayload.payload;

    if (!messagePayload) {
      console.warn('⚠️ No payload in webhook');
      return;
    }

    const phoneNumber = messagePayload.source;
    const senderName =
      messagePayload.sender?.name || `Patient ${phoneNumber.slice(-4)}`;
    const messageType = messagePayload.type || 'text';
    const gupshupMessageId = messagePayload.id;

    // Extract message text based on type
    let messageText = '';
    if (messageType === 'text') {
      messageText = messagePayload.payload?.text || '';
    } else if (messageType === 'image') {
      messageText = '[📷 Image]';
    } else if (messageType === 'audio') {
      messageText = '[🎵 Audio]';
    } else if (messageType === 'video') {
      messageText = '[🎥 Video]';
    } else if (messageType === 'document') {
      messageText = '[📄 Document]';
    } else if (messageType === 'location') {
      messageText = '[📍 Location]';
    } else {
      messageText = `[${messageType}]`;
    }

    if (!phoneNumber || !messageText) {
      console.warn('⚠️ Missing phone or message in webhook payload');
      return;
    }

    console.log(`📩 Incoming from ${phoneNumber}: "${messageText.slice(0, 50)}"`);

    // Find or create conversation
    let conversation = await this.prisma.conversation.findUnique({
      where: { phoneNumber },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          patientName: senderName,
          phoneNumber,
          lastMessage: messageText,
          lastMessageTime: new Date(),
          unreadCount: 1,
        },
      });
      console.log(`✨ New conversation created for ${senderName}`);
    } else {
      // Update patient name if Gupshup provides a better one
      const updateData: any = {
        lastMessage: messageText,
        lastMessageTime: new Date(),
        unreadCount: { increment: 1 },
      };

      // Update name if it was a placeholder and now we have a real name
      if (
        conversation.patientName.startsWith('Patient ') &&
        !senderName.startsWith('Patient ')
      ) {
        updateData.patientName = senderName;
      }

      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: updateData,
      });
    }

    // Store the message
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        gupshupMessageId,
        senderType: 'patient',
        message: messageText,
        messageType,
        status: 'received',
      },
    });

    // Emit real-time events via Socket.IO
    this.eventsGateway.emitNewMessage(conversation.id, {
      id: message.id,
      conversationId: conversation.id,
      senderType: 'patient',
      message: messageText,
      messageType,
      status: 'received',
      createdAt: message.createdAt,
    });

    this.eventsGateway.emitConversationUpdated({
      id: conversation.id,
      patientName: conversation.patientName,
      phoneNumber: conversation.phoneNumber,
      lastMessage: messageText,
      lastMessageTime: conversation.lastMessageTime,
      unreadCount: conversation.unreadCount,
    });

    return message;
  }

  /**
   * Handle message status updates from Gupshup.
   *
   * Gupshup message-event payload:
   * {
   *   "app": "AppName",
   *   "timestamp": 1718007189549,
   *   "type": "message-event",
   *   "payload": {
   *     "id": "ABEGkYaYVSEEAhAL...",
   *     "gsId": "9b71295f-...",
   *     "type": "sent" | "delivered" | "read" | "failed",
   *     "destination": "918x98xx21x4",
   *     "payload": { ... }
   *   }
   * }
   */
  async handleStatusUpdate(webhookPayload: any) {
    const eventPayload = webhookPayload.payload;

    if (!eventPayload) return;

    const gupshupMessageId = eventPayload.gsId || eventPayload.id;
    const status = eventPayload.type; // sent, delivered, read, failed

    if (!gupshupMessageId || !status) return;

    console.log(`📊 Status update: ${gupshupMessageId} → ${status}`);

    // Find and update the message status
    const message = await this.prisma.message.findFirst({
      where: { gupshupMessageId },
    });

    if (message) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status },
      });

      // Emit status update via Socket.IO
      this.eventsGateway.emitMessageStatus(message.id, status);
    }
  }
}
