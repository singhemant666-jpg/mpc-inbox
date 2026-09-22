import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  Req,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  /**
   * GET /api/conversations
   * List all conversations assigned to the logged-in user
   */
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.findAll({
      userId: req.user.sub,
      userRole: req.user.role,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  /**
   * GET /api/conversations/unread-count
   * Get total unread message count for the logged-in user
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.conversationsService.getTotalUnreadCount(req.user.sub, req.user.role);
  }

  /**
   * GET /api/conversations/:id
   * Get a single conversation
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  /**
   * POST /api/conversations/read
   * Mark a conversation as read
   */
  @Post('read')
  async markAsRead(@Body('conversationId') conversationId: string) {
    return this.conversationsService.markAsRead(conversationId);
  }

  /**
   * POST /api/conversations/:id/convert
   * Convert a lead conversation to an existing patient conversation
   */
  @Post(':id/convert')
  async convertToPatient(@Param('id') id: string) {
    return this.conversationsService.convertToPatient(id);
  }

  /**
   * POST /api/conversations/:id/transfer-to-leads
   * Transfer a conversation back to the leads account
   */
  @Post(':id/transfer-to-leads')
  async transferToLeads(@Param('id') id: string) {
    return this.conversationsService.transferToLeads(id);
  }

  /**
   * POST /api/conversations/initiate
   * Find or initiate conversation by phone number (e.g. from broadcast)
   */
  @Post('initiate')
  async initiate(
    @Req() req: any,
    @Body('phoneNumber') phoneNumber: string,
    @Body('patientName') patientName?: string,
  ) {
    return this.conversationsService.findOrCreateByPhone({
      userId: req.user.sub,
      phoneNumber,
      patientName,
    });
  }
}

