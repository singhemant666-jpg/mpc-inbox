import { NextResponse } from 'next/server';
import axios from 'axios';

// GET /api/broadcast/template-preview?templateId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
    }

    const apiKey = process.env.GUPSHUP_API_KEY || 'sk_2c0ed702980c40e8856769f5c725871f';
    const appId = process.env.GUPSHUP_APP_ID || '1b726932-91ca-489f-ba2d-56422a7cfafb';

    const response = await axios.get(
      `https://api.gupshup.io/wa/app/${appId}/template`,
      {
        headers: { apikey: apiKey },
        timeout: 15000,
      }
    );

    const templates = response.data?.templates || [];
    const template = templates.find((t: any) => t.id === templateId);

    if (!template) {
      return NextResponse.json({
        success: false,
        error: `Template with ID "${templateId}" not found in Gupshup app`,
        availableTemplates: templates.map((t: any) => ({
          id: t.id,
          name: t.elementName,
          category: t.category,
          status: t.status,
        })),
      });
    }

    // Parse the template body
    let body = template.data || '';
    const name = template.elementName || '';
    const category = template.category || '';
    const status = template.status || '';
    const templateType = template.templateType || 'TEXT';

    // Extract buttons from containerMeta
    let buttons: any[] = [];
    try {
      const meta = JSON.parse(template.containerMeta || '{}');
      buttons = meta.buttons || [];
    } catch {
      // ignore parse errors
    }

    // Strip trailing button notation from body e.g. " | [Call For Appointment,+918169400903]"
    const buttonMatch = body.match(/\s*\|\s*\[([^\]]+)\]\s*$/);
    if (buttonMatch) {
      if (buttons.length === 0) {
        const parts = buttonMatch[1].split(',');
        buttons.push({ text: parts[0]?.trim(), value: parts[1]?.trim() });
      }
      body = body.replace(/\s*\|\s*\[[^\]]+\]\s*$/, '').trim();
    }

    // Extract mediaUrl if template has media header (e.g. sample media uploaded in Gupshup)
    let mediaUrl: string | null = null;
    try {
      const containerObj = JSON.parse(template.containerMeta || '{}');
      if (containerObj.mediaUrl) mediaUrl = containerObj.mediaUrl;
    } catch {}
    if (!mediaUrl && template.meta) {
      try {
        const metaObj = JSON.parse(template.meta || '{}');
        if (metaObj.mediaUrl) mediaUrl = metaObj.mediaUrl;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name,
        category,
        status,
        templateType,
        mediaUrl,
        body,
        buttons,
        paramCount: (body.match(/\{\{\d+\}\}/g) || []).length,
      },
    });
  } catch (error: any) {
    console.error('Template preview API error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
