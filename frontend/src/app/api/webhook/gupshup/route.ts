import { NextResponse } from 'next/server';
import { updateBroadcastStatus, recordCustomerReply } from '@/lib/db';
import axios from 'axios';

// Gupshup GET verification check
export async function GET() {
  return new Response('Gupshup Webhook Active', { status: 200 });
}

// Gupshup POST event handler
export async function POST(req: Request) {
  try {
    let body: any;
    const text = await req.text();
    if (!text || !text.trim()) {
      return new Response('OK', { status: 200 });
    }

    try {
      body = JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    console.log('📡 [Gupshup Webhook Received]:', JSON.stringify(body).slice(0, 300));

    // 1. Forward webhook to NestJS Patient Inbox backend on port 3001
    // This allows conversations, messages, and WebSockets to be created and updated in real-time
    try {
      await axios.post('http://localhost:3001/api/webhook/gupshup', body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      console.log('✅ Webhook forwarded to NestJS Patient Inbox backend (3001)');
    } catch (fwdErr: any) {
      console.warn('⚠️ Webhook forward to 3001 warning:', fwdErr.message);
    }

    // 2. Handle Incoming Patient Message (Customer Reply)
    if (body?.type === 'message' && body.payload) {
      const msgPayload = body.payload;
      const senderPhone = msgPayload.source || msgPayload.sender?.phone;
      const senderName = msgPayload.sender?.name || 'Patient';
      const text =
        msgPayload.payload?.text ||
        msgPayload.text ||
        msgPayload.payload?.title ||
        (msgPayload.type ? `[${msgPayload.type} message]` : 'Customer replied');

      if (senderPhone) {
        console.log(`💬 [Customer Reply Recorded] ${senderPhone} (${senderName}): ${text}`);
        recordCustomerReply({
          phone: senderPhone,
          name: senderName,
          replyText: text,
        });
      }
    }

    // 3. Handle Message Status Events: sent, delivered, read, failed
    if (body?.type === 'message-event' && body.payload) {
      const eventPayload = body.payload;
      const statusType = eventPayload.type; // 'enqueued', 'sent', 'delivered', 'read', 'failed'
      const gsId = eventPayload.gsId;
      const wamid = eventPayload.id;
      const destination = eventPayload.destination;

      let errorMsg = '';
      if (statusType === 'failed' && eventPayload.payload) {
        errorMsg =
          eventPayload.payload.reason ||
          eventPayload.payload.code ||
          JSON.stringify(eventPayload.payload);
      }

      console.log(`📊 [Webhook Status Update] ${destination || gsId || wamid} -> ${statusType}`);

      const eventTimestamp = eventPayload.timestamp
        ? new Date(eventPayload.timestamp).toISOString()
        : new Date().toISOString();

      updateBroadcastStatus({
        messageId: wamid,
        gsId: gsId,
        phone: destination,
        status: statusType,
        error: errorMsg,
        timestamp: eventTimestamp,
      });
    }

    // Also support fallback format if payload is nested differently
    if (body?.event === 'message-status' || body?.status) {
      const statusType = body.type || body.status;
      const msgId = body.id || body.messageId || body.gsId;
      if (statusType && msgId) {
        updateBroadcastStatus({
          messageId: msgId,
          phone: body.destination,
          status: statusType,
          error: body.reason || body.error,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Gupshup Webhook Error:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 200 });
  }
}
