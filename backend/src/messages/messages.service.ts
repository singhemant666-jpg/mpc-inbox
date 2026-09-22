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

    // Check if 24-hour session window is active (for logging/audit)
    const lastPatientMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        senderType: 'patient',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastPatientMessage) {
      const lastActiveTime = new Date(lastPatientMessage.createdAt).getTime();
      const hoursElapsed = (Date.now() - lastActiveTime) / (1000 * 60 * 60);
      if (hoursElapsed > 24) {
        console.warn(
          `⚠️ Sending to ${conversation.phoneNumber} outside standard 24h window (${Math.floor(hoursElapsed)}h elapsed). Attempting delivery.`
        );
      }
    } else {
      console.log(`ℹ️ First outgoing message to ${conversation.phoneNumber}. Attempting delivery.`);
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

  /**
   * Delete a message (from inbox database only).
   */
  async deleteMessage(id: string) {
    const existingMessage = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      throw new NotFoundException('Message not found');
    }

    // Delete the message
    await this.prisma.message.delete({
      where: { id },
    });

    // Check if this was the latest message in the conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: existingMessage.conversationId },
    });

    if (conversation) {
      // Find the new latest message for this conversation
      const latestMessage = await this.prisma.message.findFirst({
        where: { conversationId: existingMessage.conversationId },
        orderBy: { createdAt: 'desc' },
      });

      const newPreview = latestMessage ? this.getMessagePreviewText(latestMessage) : '';
      const newSender = latestMessage ? latestMessage.senderType : 'patient';
      const newTime = latestMessage ? latestMessage.createdAt : new Date();

      await this.prisma.conversation.update({
        where: { id: existingMessage.conversationId },
        data: {
          lastMessage: newPreview,
          lastMessageSender: newSender,
          lastMessageTime: newTime,
        },
      });

      // Emit conversation update
      this.eventsGateway.emitConversationUpdated({
        id: conversation.id,
        patientName: conversation.patientName,
        phoneNumber: conversation.phoneNumber,
        lastMessage: newPreview,
        lastMessageSender: newSender,
        lastMessageTime: newTime,
        unreadCount: conversation.unreadCount,
        conversationType: conversation.conversationType,
        assignedUserId: conversation.assignedUserId,
      });
    }

    // Emit message_deleted via Socket.IO
    this.eventsGateway.server.emit('message_deleted', {
      id,
      conversationId: existingMessage.conversationId,
    });

    return { success: true };
  }

  /**
   * Helper to get a clean formatted preview text for different message types.
   */
  private getMessagePreviewText(message: { message: string; messageType: string }): string {
    const { message: text, messageType } = message;
    if (messageType === 'reaction') {
      try {
        const parsed = JSON.parse(text);
        return parsed.emoji ? `Reacted ${parsed.emoji}` : 'Reaction removed';
      } catch {
        return 'Reacted';
      }
    }
    if (messageType === 'image') return '📷 Image';
    if (messageType === 'video') return '🎥 Video';
    if (messageType === 'audio') return '🎵 Audio';
    if (messageType === 'document') return '📄 Document';
    return text;
  }
}
