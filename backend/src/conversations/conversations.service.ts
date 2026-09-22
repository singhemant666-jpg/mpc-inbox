import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Get all conversations assigned to the given user,
   * sorted by last message time (newest first).
   * Supports pagination and search by name, phone, or message content.
   */
  async findAll(params: {
    userId: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      assignedUserId: userId,
    };

    if (search) {
      where.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { lastMessage: { contains: search, mode: 'insensitive' } },
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
   * Get total unread count across conversations assigned to the given user
   */
  async getTotalUnreadCount(userId: string) {
    const result = await this.prisma.conversation.aggregate({
      where: { assignedUserId: userId },
      _sum: { unreadCount: true },
    });
    return { totalUnread: result._sum.unreadCount || 0 };
  }

  /**
   * Convert a New Lead conversation to an Existing Patient conversation
   * and assign it to the Admin account (admin@mypainclnic.com).
   */
  async convertToPatient(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { email: process.env.ADMIN_EMAIL || 'admin@mypainclnic.com' },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        conversationType: 'existing_patient',
        assignedUserId: adminUser.id,
      },
    });

    // Emit the update via WebSockets so that:
    // 1. It is removed from the Lead Manager's screen in real-time
    // 2. It appears on the Admin's screen in real-time
    this.eventsGateway.emitConversationUpdated({
      id: updated.id,
      patientName: updated.patientName,
      phoneNumber: updated.phoneNumber,
      lastMessage: updated.lastMessage,
      lastMessageSender: updated.lastMessageSender,
      lastMessageTime: updated.lastMessageTime,
      unreadCount: updated.unreadCount,
      conversationType: updated.conversationType,
      assignedUserId: updated.assignedUserId,
    });

    return updated;
  }

  /**
   * Transfer an Existing Patient conversation back to the Leads account
   * and assign it to the Leads user (leads@mypainclnic.com).
   */
  async transferToLeads(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const leadsUser = await this.prisma.user.findUnique({
      where: { email: process.env.LEADS_EMAIL || 'leads@mypainclnic.com' },
    });

    if (!leadsUser) {
      throw new NotFoundException('Leads user not found');
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        conversationType: 'new_lead',
        assignedUserId: leadsUser.id,
      },
    });

    // Emit WebSocket update
    this.eventsGateway.emitConversationUpdated({
      id: updated.id,
      patientName: updated.patientName,
      phoneNumber: updated.phoneNumber,
      lastMessage: updated.lastMessage,
      lastMessageSender: updated.lastMessageSender,
      lastMessageTime: updated.lastMessageTime,
      unreadCount: updated.unreadCount,
      conversationType: updated.conversationType,
      assignedUserId: updated.assignedUserId,
    });

    return updated;
  }

  /**
   * Find or create conversation by phone number.
   * Useful when staff want to open or initiate a chat with a broadcast recipient.
   */
  async findOrCreateByPhone(params: {
    userId: string;
    phoneNumber: string;
    patientName?: string;
  }) {
    const cleanPhone = params.phoneNumber.replace(/\D/g, '');
    const altPhone = cleanPhone.startsWith('91') ? cleanPhone.slice(2) : '91' + cleanPhone;

    let conv = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { phoneNumber: cleanPhone },
          { phoneNumber: altPhone },
          { phoneNumber: { contains: cleanPhone.slice(-10) } },
        ],
      },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          phoneNumber: cleanPhone,
          patientName: params.patientName || 'Patient',
          conversationType: 'existing_patient',
          assignedUserId: params.userId,
          unreadCount: 0,
        },
      });
      this.eventsGateway.emitConversationUpdated(conv);
    } else if (conv.assignedUserId !== params.userId) {
      conv = await this.prisma.conversation.update({
        where: { id: conv.id },
        data: { assignedUserId: params.userId },
      });
      this.eventsGateway.emitConversationUpdated(conv);
    }

    return conv;
  }
}

