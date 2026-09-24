import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = './public/uploads';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private bucket: string;

  constructor() {
    // Ensure local upload dir exists as fallback
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'chat-media';

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        this.logger.log(`☁️ Supabase Storage initialized for bucket="${this.bucket}"`);
      } catch (err) {
        this.logger.error('Failed to initialize Supabase client:', err);
      }
    } else {
      this.logger.warn('⚠️ Supabase credentials missing. Falling back to local disk storage.');
    }
  }

  /**
   * Uploads a Buffer (from file upload) to Supabase Storage.
   * Returns permanent public URL or falls back to local storage URL.
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType?: string,
  ): Promise<string> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(this.bucket)
          .upload(filename, buffer, {
            contentType: contentType || 'application/octet-stream',
            upsert: true,
          });

        if (error) {
          throw error;
        }

        const { data: publicData } = this.supabase.storage
          .from(this.bucket)
          .getPublicUrl(data.path);

        this.logger.log(`☁️ File uploaded to Supabase Storage: ${publicData.publicUrl}`);
        return publicData.publicUrl;
      } catch (err: any) {
        this.logger.warn(`⚠️ Supabase upload failed, falling back to local disk: ${err.message}`);
      }
    }

    // Fallback: save to local disk
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return `/public/uploads/${filename}`;
  }

  /**
   * Downloads media from an external URL (e.g. Gupshup CDN) and uploads
   * to Supabase Storage permanently.
   */
  async uploadFromUrl(externalUrl: string, mediaType: string): Promise<string> {
    try {
      if (!externalUrl) return externalUrl;

      const response = await axios.get(externalUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const contentType = String(response.headers['content-type'] || '');
      let ext = 'bin';
      if (mediaType === 'audio') {
        ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp3') ? 'mp3' : 'ogg';
      } else if (mediaType === 'image') {
        ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      } else if (mediaType === 'video') {
        ext = 'mp4';
      } else if (mediaType === 'document' || mediaType === 'file') {
        try {
          const urlPath = new URL(externalUrl).pathname;
          const urlExt = path.extname(urlPath).replace('.', '');
          ext = urlExt || 'pdf';
        } catch {
          ext = 'pdf';
        }
      } else if (mediaType === 'sticker') {
        ext = 'webp';
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${mediaType}.${ext}`;
      const buffer = Buffer.from(response.data);

      return await this.uploadBuffer(buffer, filename, contentType || undefined);
    } catch (error: any) {
      this.logger.error(`⚠️ Failed to download and store media (${mediaType}): ${error.message}`);
      return externalUrl;
    }
  }
}
