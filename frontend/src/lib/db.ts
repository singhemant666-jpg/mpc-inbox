import fs from 'fs';
import path from 'path';

let dbInstance: any = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  // Resolve path to backend/prisma/dev.db
  const possiblePaths = [
    path.resolve(process.cwd(), '..', 'backend', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'backend', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db'),
    'c:/Users/DELL/Documents/mpc inbox/backend/prisma/dev.db',
  ];

  let dbPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  if (!dbPath) {
    dbPath = path.resolve(process.cwd(), 'dev.db');
  }

  try {
    // Use native Node.js 22+ SQLite
    const { DatabaseSync } = require('node:sqlite');
    dbInstance = new DatabaseSync(dbPath);

    // Ensure tables exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS inbox_broadcast_campaigns (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        template_name TEXT,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inbox_broadcast_logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        status TEXT NOT NULL,
        gupshup_message_id TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    return dbInstance;
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
    return null;
  }
}

export function saveBroadcastLog(data: {
  name: string;
  phone: string;
  status: 'submitted' | 'failed';
  messageId?: string;
  error?: string;
  campaignId?: string;
}) {
  const db = getDatabase();
  if (!db) return;

  try {
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO inbox_broadcast_logs (id, campaign_id, name, phone, status, gupshup_message_id, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.campaignId || null,
      data.name,
      data.phone,
      data.status,
      data.messageId || null,
      data.error || null,
      now
    );
  } catch (err) {
    console.error('Error saving broadcast log to SQLite:', err);
  }
}

export function getBroadcastHistory(limit = 100) {
  const db = getDatabase();
  if (!db) return [];

  try {
    const stmt = db.prepare(`
      SELECT id, campaign_id as campaignId, name, phone, status, gupshup_message_id as messageId, error_message as error, created_at as createdAt
      FROM inbox_broadcast_logs
      ORDER BY datetime(created_at) DESC, created_at DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (err) {
    console.error('Error reading broadcast logs from SQLite:', err);
    return [];
  }
}

export function updateBroadcastStatus(data: {
  messageId?: string;
  gsId?: string;
  phone?: string;
  status: string;
  error?: string;
}) {
  const db = getDatabase();
  if (!db) return false;

  try {
    const ids = [data.messageId, data.gsId].filter(Boolean);
    let updated = false;

    if (ids.length > 0) {
      for (const id of ids) {
        const stmt = db.prepare(`
          UPDATE inbox_broadcast_logs
          SET status = ?, error_message = COALESCE(?, error_message)
          WHERE gupshup_message_id = ?
        `);
        const res = stmt.run(data.status, data.error || null, id);
        if (res.changes > 0) {
          updated = true;
          break;
        }
      }
    }

    // Fallback: update most recent log matching phone if message ID wasn't matched
    if (!updated && data.phone) {
      const cleanPhone = String(data.phone).replace(/\D/g, '');
      // Derive alternate phone format: if starts with 91, strip it; else add 91
      const altPhone = cleanPhone.startsWith('91') ? cleanPhone.slice(2) : '91' + cleanPhone;
      const stmt = db.prepare(`
        UPDATE inbox_broadcast_logs
        SET status = ?, error_message = COALESCE(?, error_message), gupshup_message_id = COALESCE(?, gupshup_message_id)
        WHERE id = (
          SELECT id FROM inbox_broadcast_logs
          WHERE (phone = ? OR phone = ?)
          ORDER BY created_at DESC
          LIMIT 1
        )
      `);
      stmt.run(data.status, data.error || null, data.messageId || data.gsId || null, cleanPhone, altPhone);
    }

    return true;
  } catch (err) {
    console.error('Error updating broadcast status in SQLite:', err);
    return false;
  }
}

