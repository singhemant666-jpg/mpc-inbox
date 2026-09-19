import { NextResponse } from 'next/server';
import axios from 'axios';

// GET /api/broadcast/templates - List approved Gupshup templates
export async function GET() {
  try {
    const apiKey = process.env.GUPSHUP_API_KEY || 'sk_2c0ed702980c40e8856769f5c725871f';
    const appId = process.env.GUPSHUP_APP_ID || '1b726932-91ca-489f-ba2d-56422a7cfafb';

    const response = await axios.get(
      `https://api.gupshup.io/wa/app/${appId}/template`,
      {
        headers: { apikey: apiKey },
        timeout: 15000,
      }
    );

    const rawTemplates = response.data?.templates || [];
    const templates = rawTemplates
      .filter((t: any) => t.status === 'APPROVED')
      .map((t: any) => {
        let body = t.data || '';
        let buttons: any[] = [];
        try {
          const meta = JSON.parse(t.containerMeta || '{}');
          buttons = meta.buttons || [];
        } catch {
          // ignore
        }

        const buttonMatch = body.match(/\s*\|\s*\[([^\]]+)\]\s*$/);
        if (buttonMatch) {
          if (buttons.length === 0) {
            const parts = buttonMatch[1].split(',');
            buttons.push({ text: parts[0]?.trim(), value: parts[1]?.trim() });
          }
          body = body.replace(/\s*\|\s*\[[^\]]+\]\s*$/, '').trim();
        }

        let mediaUrl: string | null = null;
        try {
          const containerObj = JSON.parse(t.containerMeta || '{}');
          if (containerObj.mediaUrl) mediaUrl = containerObj.mediaUrl;
        } catch {}
        if (!mediaUrl && t.meta) {
          try {
            const metaObj = JSON.parse(t.meta || '{}');
            if (metaObj.mediaUrl) mediaUrl = metaObj.mediaUrl;
          } catch {}
        }

        return {
          id: t.id,
          name: t.elementName,
          category: t.category,
          status: t.status,
          templateType: t.templateType || 'TEXT',
          mediaUrl,
          body,
          buttons,
          paramCount: (body.match(/\{\{\d+\}\}/g) || []).length,
        };
      });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error('List templates error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
