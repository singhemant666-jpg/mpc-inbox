import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  /**
   * GET /api/webhook/gupshup
   * Simple health check and URL validation endpoint
   */
  @Get('gupshup')
  verifyWebhook() {
    return { status: 'active', message: 'MPC Gupshup Webhook Endpoint Online' };
  }

  /**
   * POST /api/webhook/gupshup
   *
   * Receives incoming Gupshup webhook events:
   * - type: "message" → incoming patient message
   * - type: "message-event" → delivery/read status updates
   */
  @Post('gupshup')
  @HttpCode(200)
  async handleGupshupWebhook(@Body() payload: any) {
    try {
      const eventType = payload.type;

      if (eventType === 'message') {
        await this.webhookService.handleIncomingMessage(payload);
      } else if (eventType === 'message-event') {
        await this.webhookService.handleStatusUpdate(payload);
      }

      return { status: 'received' };
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      // Always return 200 to Gupshup to avoid retries
      return { status: 'error', message: 'Processing failed' };
    }
  }
}
