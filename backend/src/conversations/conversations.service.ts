import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all conversations, sorted by last message time (newest first).
   * Supports pagination and search by name, phone, or message content.
   */
  async findAll(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { patientName: { contains: search } },
        { phoneNumber: { contains: search } },
        { lastMessage: { contains: search } },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single conversation by ID
   */
  async findOne(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
    });
  }

  /**
   * Mark a conversation as read (reset unread count to 0)
   */
  async markAsRead(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  /**
   * Get total unread count across all conversations
   */
  async getTotalUnreadCount() {
    const result = await this.prisma.conversation.aggregate({
      _sum: { unreadCount: true },
    });
    return { totalUnread: result._sum.unreadCount || 0 };
  }
}
