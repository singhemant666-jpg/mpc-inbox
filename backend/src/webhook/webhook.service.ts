import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Media upload directory (same as messages controller uses)
const UPLOAD_DIR = './public/uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Phrases that indicate a new lead (first message from patient)
const NEW_LEAD_PHRASES = [
  'Hello! Can I get more info on this?',
  "Hi, I'd like to book a consultation.",
  '[button_reply]',
];

function isNewLead(messageText: string): boolean {
  const normalized = messageText.trim().toLowerCase();
  return NEW_LEAD_PHRASES.some(
    (phrase) => normalized === phrase.toLowerCase(),
  );
}

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Look up the user ID to assign a conversation to, based on its type.
   * - "new_lead" → leads@mypainclnic.com
   * - "existing_patient" → admin@mypainclnic.com
   */
  private async getAssignedUserId(
    conversationType: string,
  ): Promise<string | null> {
    const email =
      conversationType === 'new_lead'
        ? process.env.LEADS_EMAIL || 'leads@mypainclnic.com'
        : process.env.ADMIN_EMAIL || 'admin@mypainclnic.com';

    const user = await this.prisma.user.findUnique({ where: { email } });
    return user?.id || null;
  }

  /**
   * Download media from a Gupshup URL and store it locally.
   * Returns the local URL path (e.g., /public/uploads/1234567890-audio.ogg)
   * Falls back to the original URL if download fails.
   */
  private async downloadAndStoreMedia(
    externalUrl: string,
    mediaType: string,
  ): Promise<string> {
    try {
      if (!externalUrl) return externalUrl;

      const response = await axios.get(externalUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Determine file extension from content-type or mediaType
      const contentType = response.headers['content-type'] || '';
      let ext = 'bin';
      if (mediaType === 'audio') {
        ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp3') ? 'mp3' : 'ogg';
      } else if (mediaType === 'image') {
        ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      } else if (mediaType === 'video') {
        ext = contentType.includes('mp4') ? 'mp4' : 'mp4';
      } else if (mediaType === 'document' || mediaType === 'file') {
        // Try to extract extension from URL
        const urlPath = new URL(externalUrl).pathname;
        const urlExt = path.extname(urlPath).replace('.', '');
        ext = urlExt || 'pdf';
      } else if (mediaType === 'sticker') {
        ext = 'webp';
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${mediaType}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      fs.writeFileSync(filepath, Buffer.from(response.data));

      console.log(`💾 Media saved locally: ${filepath} (${(response.data.byteLength / 1024).toFixed(1)} KB)`);

      // Return a relative URL that the frontend can access via the static file server
      return `/public/uploads/${filename}`;
    } catch (error) {
      console.error(`⚠️ Failed to download media (${mediaType}):`, error.message);
      // Fall back to the original Gupshup URL (may expire)
      return externalUrl;
    }
  }

  /**
   * Handle an incoming patient message from Gupshup webhook.
   *
   * Gupshup payload format:
   * {
   *   "app": "AppName",
   *   "timestamp": 1718007189549,
   *   "version": 2,
   *   "type": "message",
   *   "payload": {
   *     "id": "ABEGkYaYVSEEAhAL...",
   *     "source": "918x98xx21x4",
   *     "type": "text",
   *     "payload": { "text": "Hello doctor" },
   *     "sender": {
   *       "phone": "918x98xx21x4",
   *       "name": "Patient Name",
   *       "country_code": "91",
   *       "dial_code": "8x98xx21x4"
   *     }
   *   }
   * }
   */
  async handleIncomingMessage(webhookPayload: any) {
    const messagePayload = webhookPayload.payload;

    if (!messagePayload) {
      console.warn('⚠️ No payload in webhook');
      return;
    }

    const phoneNumber = messagePayload.source;
    const senderName =
      messagePayload.sender?.name || `Patient ${phoneNumber.slice(-4)}`;
    const messageType = messagePayload.type || 'text';
    const gupshupMessageId = messagePayload.id;

    // Extract message text and sidebar preview text based on type
    let messageText = '';
    let previewText = '';

    if (messageType === 'text') {
      messageText = messagePayload.payload?.text || '';
      previewText = messageText;
    } else if (messageType === 'button_reply') {
      messageText = messagePayload.payload?.text || messagePayload.payload?.title || '[button_reply]';
      previewText = messageText;
    } else if (messageType === 'reaction') {
      // Debug write to inspect the exact payload
      try {
        const debugPath = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\f4ebd43d-7641-4ef0-a94b-d8cfaa891cc5\\scratch\\reaction_payload.json';
        const fs = require('fs');
        const dir = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\f4ebd43d-7641-4ef0-a94b-d8cfaa891cc5\\scratch';
        if (!fs.existsSync(dir)){
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(debugPath, JSON.stringify(webhookPayload, null, 2));
        console.log('📝 Saved debug reaction payload to scratch');
      } catch (e) {
        console.error('Failed to write debug payload:', e);
      }

      const emoji = messagePayload.payload?.emoji;
      
      // Look for target message ID in all possible Gupshup/WhatsApp fields
      const targetMessageId = 
        messagePayload.payload?.id || 
        messagePayload.payload?.messageId || 
        messagePayload.payload?.message_id || 
        webhookPayload.context?.id || 
        webhookPayload.context?.gsId;
      
      const contextId = webhookPayload.context?.id;
      const contextGsId = webhookPayload.context?.gsId;
      
      messageText = JSON.stringify({ 
        emoji, 
        targetMessageId,
        contextId,
        contextGsId
      });
      
      let originalText = '';
      if (targetMessageId || contextId || contextGsId) {
        const originalMsg = await this.prisma.message.findFirst({
          where: {
            OR: [
              { gupshupMessageId: targetMessageId },
              { gupshupMessageId: contextId },
              { gupshupMessageId: contextGsId },
            ].filter(cond => cond.gupshupMessageId), // Filter out undefined/null conditions
          },
        });
        if (originalMsg) {
          originalText = originalMsg.message;
        }
      }
      
      if (emoji) {
        previewText = originalText
          ? `Reacted ${emoji} to: "${originalText.slice(0, 20)}${originalText.length > 20 ? '...' : ''}"`
          : `Reacted ${emoji}`;
      } else {
        previewText = 'Reaction removed';
      }
    } else if (messageType === 'image') {
      const gupshupUrl = messagePayload.payload?.url || '';
      messageText = await this.downloadAndStoreMedia(gupshupUrl, 'image');
      previewText = '📷 Image';
    } else if (messageType === 'audio') {
      const gupshupUrl = messagePayload.payload?.url || '';
      messageText = await this.downloadAndStoreMedia(gupshupUrl, 'audio');
      previewText = '🎵 Audio';
    } else if (messageType === 'video') {
      const gupshupUrl = messagePayload.payload?.url || '';
      messageText = await this.downloadAndStoreMedia(gupshupUrl, 'video');
      previewText = '🎥 Video';
    } else if (messageType === 'document' || messageType === 'file') {
      const gupshupUrl = messagePayload.payload?.url || '';
      messageText = await this.downloadAndStoreMedia(gupshupUrl, 'document');
      previewText = '📄 Document';
    } else if (messageType === 'sticker') {
      const gupshupUrl = messagePayload.payload?.url || '';
      messageText = await this.downloadAndStoreMedia(gupshupUrl, 'sticker');
      previewText = '🏷️ Sticker';
    } else if (messageType === 'location') {
      messageText = messagePayload.payload?.url || '';
      previewText = '📍 Location';
    } else {
      messageText = `[${messageType}]`;
      previewText = `[${messageType}]`;
    }

    if (!phoneNumber || !messageText) {
      console.warn('⚠️ Missing phone or message in webhook payload');
      return;
    }

    console.log(`📩 Incoming from ${phoneNumber}: "${previewText.slice(0, 50)}"`);

    // Find or create conversation
    let conversation = await this.prisma.conversation.findUnique({
      where: { phoneNumber },
    });

    if (!conversation) {
      // This is the FIRST message from this phone number → classify it
      const conversationType = isNewLead(messageText)
        ? 'new_lead'
        : 'existing_patient';
      const assignedUserId = await this.getAssignedUserId(conversationType);

      conversation = await this.prisma.conversation.create({
        data: {
          patientName: senderName,
          phoneNumber,
          conversationType,
          assignedUserId,
          lastMessage: previewText,
          lastMessageSender: 'patient',
          lastMessageTime: new Date(),
          unreadCount: 1,
        },
      });
      console.log(
        `✨ New conversation created for ${senderName} [${conversationType}] → assigned to ${assignedUserId || 'unassigned'}`,
      );
    } else {
      // Update patient name if Gupshup provides a better one
      const updateData: any = {
        lastMessage: previewText,
        lastMessageSender: 'patient',
        lastMessageTime: new Date(),
        unreadCount: { increment: 1 },
      };

      // Update name if it was a placeholder and now we have a real name
      if (
        conversation.patientName.startsWith('Patient ') &&
        !senderName.startsWith('Patient ')
      ) {
        updateData.patientName = senderName;
      }

      // If this is a button_reply message, reclassify as new_lead
      if (messageType === 'button_reply' || isNewLead(messageText)) {
        if (conversation.conversationType !== 'new_lead') {
          const leadsUserId = await this.getAssignedUserId('new_lead');
          updateData.conversationType = 'new_lead';
          updateData.assignedUserId = leadsUserId;
          console.log(
            `🔄 Conversation ${conversation.id} reclassified to new_lead (button_reply received)`,
          );
        }
      }

      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: updateData,
      });
    }

    // Store the message
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        gupshupMessageId,
        senderType: 'patient',
        message: messageText,
        messageType,
        status: 'received',
      },
    });

    // Emit real-time events via Socket.IO
    this.eventsGateway.emitNewMessage(conversation.id, {
      id: message.id,
      conversationId: conversation.id,
      senderType: 'patient',
      message: messageText,
      messageType,
      status: 'received',
      createdAt: message.createdAt,
    });

    this.eventsGateway.emitConversationUpdated({
      id: conversation.id,
      patientName: conversation.patientName,
      phoneNumber: conversation.phoneNumber,
      lastMessage: previewText,
      lastMessageSender: 'patient',
      lastMessageTime: conversation.lastMessageTime,
      unreadCount: conversation.unreadCount,
      conversationType: conversation.conversationType,
      assignedUserId: conversation.assignedUserId,
    });

    return message;
  }

  /**
   * Handle message status updates from Gupshup.
   *
   * Gupshup message-event payload:
   * {
   *   "app": "AppName",
   *   "timestamp": 1718007189549,
   *   "type": "message-event",
   *   "payload": {
   *     "id": "ABEGkYaYVSEEAhAL...",
   *     "gsId": "9b71295f-...",
   *     "type": "sent" | "delivered" | "read" | "failed",
   *     "destination": "918x98xx21x4",
   *     "payload": { ... }
   *   }
   * }
   */
  async handleStatusUpdate(webhookPayload: any) {
    const eventPayload = webhookPayload.payload;

    if (!eventPayload) return;

    const gupshupMessageId = eventPayload.gsId || eventPayload.id;
    const status = eventPayload.type; // sent, delivered, read, failed

    if (!gupshupMessageId || !status) return;

    console.log(`📊 Status update: ${gupshupMessageId} → ${status}`);

    // Find and update the message status
    const message = await this.prisma.message.findFirst({
      where: {
        OR: [
          { gupshupMessageId: eventPayload.gsId },
          { gupshupMessageId: eventPayload.id },
        ],
      },
    });

    if (message) {
      const updateData: any = { status };
      // Save the WhatsApp Message ID (wamid) in database for reaction correlation
      if (eventPayload.id && message.gupshupMessageId !== eventPayload.id) {
        updateData.gupshupMessageId = eventPayload.id;
      }

      await this.prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // Emit status update via Socket.IO
      this.eventsGateway.emitMessageStatus(message.id, status);
    }
  }
}
