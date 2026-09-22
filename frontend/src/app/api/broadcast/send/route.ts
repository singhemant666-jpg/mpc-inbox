import { NextResponse } from 'next/server';
import axios from 'axios';
import { saveBroadcastLog } from '@/lib/db';

export async function POST(req: Request) {
  let cleanPhone = '';
  let customerName = 'Customer';
  let campaignId: string | undefined;
  let campaignName: string | undefined;
  try {
    const body = await req.json();
    const {
      destination,
      name,
      templateId = '24fe8d13-f39b-4bee-8599-850e0bea5bc9',
      sourceNumber = process.env.GUPSHUP_SOURCE_NUMBER || '917304226441',
      appName = process.env.GUPSHUP_APP_NAME || 'mpcUAT',
      apiKey = process.env.GUPSHUP_API_KEY || 'sk_2c0ed702980c40e8856769f5c725871f',
      imageUrl,
    } = body;
    campaignId = body.campaignId;
    campaignName = body.campaignName;

    customerName = name || 'Customer';

    if (!destination) {
      return NextResponse.json(
        { success: false, error: 'Destination phone number is required' },
        { status: 400 }
      );
    }

    // Clean phone number: remove non-digits
    cleanPhone = String(destination).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const templatePayload = {
      id: templateId,
      params: Array.isArray(body.params)
        ? body.params
        : (customerName ? [customerName] : []),
    };

    const params = new URLSearchParams();
    params.append('channel', 'whatsapp');
    params.append('source', sourceNumber);
    params.append('destination', cleanPhone);
    params.append('src.name', appName);
    params.append('template', JSON.stringify(templatePayload));

    // Add image header if image URL is provided
    if (imageUrl) {
      params.append('message', JSON.stringify({
        type: 'image',
        image: { link: imageUrl },
      }));
    }

    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/template/msg',
      params.toString(),
      {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/x-www-form-urlencoded',
          apikey: apiKey,
        },
        timeout: 20000,
      }
    );

    const isSuccess = response.status === 200 || response.status === 202;
    
    // Save to SQLite
    saveBroadcastLog({
      campaignId: campaignId || undefined,
      campaignName: campaignName || undefined,
      name: customerName,
      phone: cleanPhone,
      status: isSuccess ? 'submitted' : 'failed',
      messageId: response.data?.messageId,
      error: isSuccess ? undefined : (response.data?.message || 'Send failed'),
    });

    return NextResponse.json({
      success: isSuccess,
      status: response.data?.status || 'submitted',
      messageId: response.data?.messageId,
      phone: cleanPhone,
      name: customerName,
      httpStatus: response.status,
    });
  } catch (error: any) {
    console.error('Broadcast API error:', error?.response?.data || error.message);
    const errorMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Failed to send template message';

    // Save failure to SQLite
    saveBroadcastLog({
      campaignId: campaignId || undefined,
      campaignName: campaignName || undefined,
      name: customerName,
      phone: cleanPhone,
      status: 'failed',
      error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg,
    });


    return NextResponse.json(
      {
        success: false,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg,
        httpStatus: error?.response?.status || 500,
      },
      { status: error?.response?.status || 500 }
    );
  }
}
