import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Ensure frontend/public/uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Clean file name
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}_${sanitizedName}`;
    const filePath = path.join(uploadsDir, filename);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    // Determine public URL: try getting ngrok tunnel first for public WhatsApp delivery
    let publicBaseUrl = '';
    try {
      const ngrokRes = await axios.get('http://127.0.0.1:4040/api/tunnels', { timeout: 1500 });
      const tunnels = ngrokRes.data?.tunnels || [];
      const httpsTunnel = tunnels.find((t: any) => t.public_url?.startsWith('https://')) || tunnels[0];
      if (httpsTunnel?.public_url) {
        publicBaseUrl = httpsTunnel.public_url;
      }
    } catch {
      // ngrok not running locally, fallback to request headers
    }

    if (!publicBaseUrl) {
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      publicBaseUrl = `${proto}://${host}`;
    }

    const publicUrl = `${publicBaseUrl}/uploads/${filename}`;
    const localUrl = `/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      localUrl,
      filename,
    });
  } catch (error: any) {
    console.error('Upload image error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
