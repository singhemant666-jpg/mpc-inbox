import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GupshupService } from './gupshup.service';
import { EventsGateway } from '../gateway/events.gateway';
import axios from 'axios';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gupshupService: GupshupService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Get messages for a conversation, paginated (newest first for scroll-up loading).
   */
  async findByConversation(params: {
    conversationId: string;
    page?: number;
    limit?: number;
  }) {
    const { conversationId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    // Verify conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data: messages,
      conversation: {
        id: conversation.id,
        patientName: conversation.patientName,
        phoneNumber: conversation.phoneNumber,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send a reply message from staff to patient.
   *
   * 1. Send via Gupshup API
   * 2. Store in database
   * 3. Update conversation metadata
   * 4. Emit Socket.IO events
   */
  async sendMessage(conversationId: string, text: string, messageType: string = 'text') {
    if (!text || !text.trim()) {
      throw new BadRequestException('Message text/URL is required');
    }

    // Get the conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if 24-hour session window is active (last patient message must be < 24 hours ago)
    const lastPatientMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        senderType: 'patient',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastPatientMessage) {
      throw new BadRequestException(
        'The 24-hour WhatsApp session window is closed. You cannot send messages because the patient has never initiated a chat.'
      );
    }

    const lastActiveTime = new Date(lastPatientMessage.createdAt).getTime();
    const now = Date.now();
    const hoursElapsed = (now - lastActiveTime) / (1000 * 60 * 60);

    if (hoursElapsed > 24) {
      throw new BadRequestException(
        `The 24-hour WhatsApp session window has closed (last patient message was ${Math.floor(hoursElapsed)} hours ago). You cannot send free-form messages.`
      );
    }

    let gupshupResult;
    if (messageType === 'text') {
      // Send text via Gupshup
      gupshupResult = await this.gupshupService.sendTextMessage(
        conversation.phoneNumber,
        text.trim(),
      );
    } else {
      // Convert local media URL to public ngrok URL for Gupshup if running locally
      let mediaUrl = text.trim();
      if (mediaUrl.includes('localhost:') || mediaUrl.includes('127.0.0.1')) {
        try {
          const ngrokResponse = await axios.get('http://localhost:4040/api/tunnels', { timeout: 1000 });
          const publicUrl = ngrokResponse.data?.tunnels?.[0]?.public_url;
          if (publicUrl) {
            const localBase = mediaUrl.substring(0, mediaUrl.indexOf('/public/'));
            mediaUrl = mediaUrl.replace(localBase, publicUrl);
            console.log(`🔄 Converted local URL to ngrok public URL for Gupshup: ${mediaUrl}`);
          }
        } catch (e) {
          // ngrok not active
        }
      }

      // Send image, video, document, or audio via Gupshup
      gupshupResult = await this.gupshupService.sendMediaMessage(
        conversation.phoneNumber,
        mediaUrl,
        messageType as any,
      );
    }

    // Store the message regardless of Gupshup result
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        gupshupMessageId: gupshupResult.messageId || null,
        senderType: 'agent',
        message: text.trim(),
        messageType,
        status: gupshupResult.success ? 'sent' : 'failed',
      },
    });

    // Formatting last message preview for the sidebar
    let previewText = text.trim();
    if (messageType === 'image') {
      previewText = '📷 Image';
    } else if (messageType === 'video') {
      previewText = '🎥 Video';
    } else if (messageType === 'document') {
      previewText = '📄 Document';
    } else if (messageType === 'audio') {
      previewText = '🎵 Audio';
    }

    // Update conversation metadata
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: previewText,
        lastMessageSender: 'agent',
        lastMessageTime: new Date(),
      },
    });

    // Emit real-time events
    this.eventsGateway.emitNewMessage(conversationId, {
      id: message.id,
      conversationId,
      senderType: 'agent',
      message: text.trim(),
      messageType,
      status: message.status,
      createdAt: message.createdAt,
    });

    this.eventsGateway.emitConversationUpdated({
      id: updatedConversation.id,
      patientName: updatedConversation.patientName,
      phoneNumber: updatedConversation.phoneNumber,
      lastMessage: previewText,
      lastMessageSender: 'agent',
      lastMessageTime: updatedConversation.lastMessageTime,
      unreadCount: updatedConversation.unreadCount,
      conversationType: updatedConversation.conversationType,
      assignedUserId: updatedConversation.assignedUserId,
    });

    return {
      message,
      gupshup: {
        success: gupshupResult.success,
        error: gupshupResult.error,
      },
    };
  }
}
