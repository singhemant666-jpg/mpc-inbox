import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  /**
   * GET /api/conversations
   * List all conversations with optional search and pagination
   */
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.findAll({
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * GET /api/conversations/unread-count
   * Get total unread message count
   */
  @Get('unread-count')
  async getUnreadCount() {
    return this.conversationsService.getTotalUnreadCount();
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
}
