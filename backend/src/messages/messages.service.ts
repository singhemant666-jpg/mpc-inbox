import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GupshupService } from './gupshup.service';
import { EventsGateway } from '../gateway/events.gateway';

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
  async sendMessage(conversationId: string, text: string) {
    if (!text || !text.trim()) {
      throw new BadRequestException('Message text is required');
    }

    // Get the conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Send via Gupshup
    const gupshupResult = await this.gupshupService.sendTextMessage(
      conversation.phoneNumber,
      text.trim(),
    );

    // Store the message regardless of Gupshup result
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        gupshupMessageId: gupshupResult.messageId || null,
        senderType: 'agent',
        message: text.trim(),
        messageType: 'text',
        status: gupshupResult.success ? 'sent' : 'failed',
      },
    });

    // Update conversation metadata
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: text.trim(),
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
      messageType: 'text',
      status: message.status,
      createdAt: message.createdAt,
    });

    this.eventsGateway.emitConversationUpdated({
      id: updatedConversation.id,
      patientName: updatedConversation.patientName,
      phoneNumber: updatedConversation.phoneNumber,
      lastMessage: text.trim(),
      lastMessageSender: 'agent',
      lastMessageTime: updatedConversation.lastMessageTime,
      unreadCount: updatedConversation.unreadCount,
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
