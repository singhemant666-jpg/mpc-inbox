import { NextResponse } from 'next/server';
import { updateBroadcastStatus } from '@/lib/db';

// Gupshup GET verification check
export async function GET() {
  return new Response('Gupshup Webhook Active', { status: 200 });
}

// Gupshup POST event handler
export async function POST(req: Request) {
  try {
    let body: any;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        body = Object.fromEntries(params.entries());
      }
    }

    console.log('📡 [Gupshup Webhook Received]:', JSON.stringify(body).slice(0, 300));

    // Handle Message Status Events: sent, delivered, read, failed
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

      updateBroadcastStatus({
        messageId: wamid,
        gsId: gsId,
        phone: destination,
        status: statusType,
        error: errorMsg,
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
        });
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Gupshup Webhook Error:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 200 });
  }
}
