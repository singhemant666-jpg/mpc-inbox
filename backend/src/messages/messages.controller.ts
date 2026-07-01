import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  /**
   * GET /api/conversations/:id/messages
   * Get messages for a specific conversation
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findByConversation({
      conversationId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * POST /api/messages/send
   * Send a reply message to a patient
   */
  @Post('messages/send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(
      sendMessageDto.conversationId,
      sendMessageDto.message,
    );
  }
}
