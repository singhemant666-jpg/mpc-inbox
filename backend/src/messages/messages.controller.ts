import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';
// @ts-ignore
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import axios from 'axios';

// Ensure upload directory exists
const UPLOAD_DIR = './public/uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
   * Send a reply message to a patient (supports text, image, video)
   */
  @Post('messages/send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(
      sendMessageDto.conversationId,
      sendMessageDto.message,
      sendMessageDto.messageType || 'text',
    );
  }

  /**
   * POST /api/messages/upload
   * Upload an image or video file
   */
  @Post('messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/public/uploads/${file.filename}`;

    return {
      url: fileUrl,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * DELETE /api/messages/:id
   * Delete a message (local database only)
   */
  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    return this.messagesService.deleteMessage(id);
  }

  /**
   * GET /api/media/proxy?url=<encoded_url>
   * Proxy external media (Gupshup CDN) to bypass CORS restrictions.
   * This allows the browser to play audio/video from external URLs.
   */
  @Get('media/proxy')
  async proxyMedia(@Query('url') url: string, @Req() req: any, @Res() res: any) {
    if (!url) {
      throw new BadRequestException('Missing url parameter');
    }

    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000,
      });

      // Forward content-type header
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);

      // Forward content-length if available
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      // Allow range requests for seeking
      res.setHeader('Accept-Ranges', 'bytes');

      // Cache for 1 hour to avoid re-fetching
      res.setHeader('Cache-Control', 'public, max-age=3600');

      response.data.pipe(res);
    } catch (error) {
      console.error('Media proxy error:', error.message);
      res.status(502).json({ error: 'Failed to fetch media' });
    }
  }
}
