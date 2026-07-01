import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GupshupService {
  private readonly apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
  private readonly apiKey = process.env.GUPSHUP_API_KEY || '';
  private readonly appName = process.env.GUPSHUP_APP_NAME || '';
  private readonly sourceNumber = process.env.GUPSHUP_SOURCE_NUMBER || '';

  /**
   * Send a text message to a patient via Gupshup WhatsApp API.
   *
   * Gupshup Send API:
   * POST https://api.gupshup.io/sm/api/v1/msg
   * Content-Type: application/x-www-form-urlencoded
   * apikey: YOUR_API_KEY
   *
   * Body:
   *   channel=whatsapp
   *   source=YOUR_NUMBER
   *   destination=PATIENT_NUMBER
   *   src.name=YOUR_APP_NAME
   *   message={"type":"text","text":"Hello"}
   */
  async sendTextMessage(
    destination: string,
    text: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.apiKey) {
        throw new Error('GUPSHUP_API_KEY not configured');
      }

      const messagePayload = JSON.stringify({
        type: 'text',
        text: text,
      });

      const params = new URLSearchParams();
      params.append('channel', 'whatsapp');
      params.append('source', this.sourceNumber);
      params.append('destination', destination);
      params.append('src.name', this.appName);
      params.append('message', messagePayload);

      const response = await axios.post(this.apiUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          apikey: this.apiKey,
        },
        timeout: 30000,
      });

      if (response.data?.status === 'submitted') {
        console.log(`✅ Message sent to ${destination.slice(0, 6)}***`);
        return {
          success: true,
          messageId: response.data?.messageId,
        };
      } else {
        console.error('❌ Gupshup send failed:', response.data);
        return {
          success: false,
          error: response.data?.message || 'Send failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Gupshup API error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
