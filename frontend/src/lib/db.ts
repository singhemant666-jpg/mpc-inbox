import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const nodeRequire = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

const globalForDb = globalThis as unknown as { dbInstance?: any };
let dbInstance: any = globalForDb.dbInstance || null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  // Resolve path to backend/prisma/dev.db
  let dbPath = process.env.DATABASE_PATH || '';
  if (!dbPath && process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    const raw = process.env.DATABASE_URL.replace('file:', '').trim();
    dbPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }

  if (!dbPath) {
    const possiblePaths = [
      path.resolve(process.cwd(), '..', 'backend', 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'backend', 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'dev.db'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dbPath = p;
        break;
      }
    }
  }

  if (!dbPath) {
    dbPath = path.resolve(process.cwd(), 'dev.db');
  }

  try {
    // Use native Node.js 22+ SQLite
    const { DatabaseSync } = nodeRequire('node:sqlite');
    dbInstance = new DatabaseSync(dbPath);
    globalForDb.dbInstance = dbInstance;

    // High performance configuration for 10k+ concurrent writes & reads
    dbInstance.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = -64000; -- 64MB cache

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

      -- Indexes to ensure instant lookups across 10,000+ logs
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_phone ON inbox_broadcast_logs(phone);
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_gsid ON inbox_broadcast_logs(gupshup_message_id);
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON inbox_broadcast_logs(status);
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created ON inbox_broadcast_logs(created_at);
    `);

    // Safely add reply_text, campaign_name, and read_at columns if not yet existing
    try {
      dbInstance.exec(`ALTER TABLE inbox_broadcast_logs ADD COLUMN reply_text TEXT;`);
    } catch (colErr) {
      // Column already exists
    }
    try {
      dbInstance.exec(`ALTER TABLE inbox_broadcast_logs ADD COLUMN campaign_name TEXT;`);
    } catch (colErr) {
      // Column already exists
    }
    try {
      dbInstance.exec(`ALTER TABLE inbox_broadcast_logs ADD COLUMN read_at TEXT;`);
    } catch (colErr) {
      // Column already exists
    }

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
  campaignName?: string;
}) {
  const db = getDatabase();
  if (!db) return;

  try {
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    // Ensure parent campaign exists in inbox_broadcast_campaigns to satisfy foreign key constraint
    if (data.campaignId) {
      try {
        const campaignStmt = db.prepare(`
          INSERT OR IGNORE INTO inbox_broadcast_campaigns (id, template_id, template_name, total_count, created_at)
          VALUES (?, ?, ?, 0, ?)
        `);
        campaignStmt.run(data.campaignId, 'marketing_template', data.campaignName || 'Broadcast Campaign', now);
      } catch (cErr) {
        // ignore if already exists
      }
    }

    const stmt = db.prepare(`
      INSERT INTO inbox_broadcast_logs (id, campaign_id, campaign_name, name, phone, status, gupshup_message_id, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.campaignId || null,
      data.campaignName || null,
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

export function getBroadcastHistory(limit = 100000) {
  const db = getDatabase();
  if (!db) return [];

  try {
    let sql = `
      SELECT id, campaign_id as campaignId, campaign_name as campaignName, name, phone, status, gupshup_message_id as messageId, error_message as error, reply_text as replyText, created_at as createdAt, read_at as readAt
      FROM inbox_broadcast_logs
      ORDER BY datetime(created_at) DESC, created_at DESC, id DESC
    `;
    let rows: any[];
    if (limit && limit > 0) {
      sql += ` LIMIT ?`;
      rows = db.prepare(sql).all(limit);
    } else {
      rows = db.prepare(sql).all();
    }

    // Normalize replies so customer responses are cleanly separated from system errors
    return rows.map((r: any) => {
      let replyText = r.replyText || null;
      let error = r.error || null;

      if (!replyText && error && /^Reply:\s*"?/i.test(error)) {
        replyText = error.replace(/^Reply:\s*"?/i, '').replace(/"?$/, '').trim();
        error = null; // Clean up so customer reply is NEVER treated as an error
      }

      return {
        ...r,
        replyText,
        error,
        readAt: r.readAt || null,
      };
    });
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
  timestamp?: string;
}) {
  const db = getDatabase();
  if (!db) return false;

  try {
    const ids = [data.messageId, data.gsId].filter(Boolean);
    const readTimestamp = data.status === 'read' ? (data.timestamp || new Date().toISOString()) : null;
    let updated = false;

    if (ids.length > 0) {
      for (const id of ids) {
        const stmt = db.prepare(`
          UPDATE inbox_broadcast_logs
          SET status = ?, 
              error_message = COALESCE(?, error_message),
              read_at = CASE WHEN ? = 'read' THEN COALESCE(?, read_at, CURRENT_TIMESTAMP) ELSE read_at END
          WHERE gupshup_message_id = ?
        `);
        const res = stmt.run(data.status, data.error || null, data.status, readTimestamp, id);
        if (res.changes > 0) {
          updated = true;
          break;
        }
      }
    }

    // Fallback: update most recent pending/submitted/delivered log matching phone ONLY if message ID wasn't matched
    if (!updated && data.phone) {
      const cleanPhone = String(data.phone).replace(/\D/g, '');
      const altPhone = cleanPhone.startsWith('91') ? cleanPhone.slice(2) : '91' + cleanPhone;
      const stmt = db.prepare(`
        UPDATE inbox_broadcast_logs
        SET status = ?, 
            error_message = COALESCE(?, error_message), 
            gupshup_message_id = COALESCE(gupshup_message_id, ?),
            read_at = CASE WHEN ? = 'read' THEN COALESCE(read_at, ?, CURRENT_TIMESTAMP) ELSE read_at END
        WHERE id = (
          SELECT id FROM inbox_broadcast_logs
          WHERE (phone = ? OR phone = ?)
            AND (status != 'replied' AND reply_text IS NULL)
          ORDER BY created_at DESC
          LIMIT 1
        )
      `);
      stmt.run(data.status, data.error || null, data.messageId || data.gsId || null, data.status, readTimestamp, cleanPhone, altPhone);
    }

    return true;
  } catch (err) {
    console.error('Error updating broadcast status in SQLite:', err);
    return false;
  }
}

export function recordCustomerReply(data: {
  phone: string;
  name?: string;
  replyText: string;
}) {
  const db = getDatabase();
  if (!db) return false;

  try {
    const cleanPhone = String(data.phone).replace(/\D/g, '');
    const altPhone = cleanPhone.startsWith('91') ? cleanPhone.slice(2) : '91' + cleanPhone;
    const replyNotice = `Reply: "${data.replyText}"`;

    // Check if there is an existing log for this customer
    const stmt = db.prepare(`
      UPDATE inbox_broadcast_logs
      SET status = 'replied', reply_text = ?, error_message = NULL
      WHERE id = (
        SELECT id FROM inbox_broadcast_logs
        WHERE (phone = ? OR phone = ?)
        ORDER BY created_at DESC
        LIMIT 1
      )
    `);
    const res = stmt.run(data.replyText, cleanPhone, altPhone);

    // If no broadcast log existed for this phone, insert a new record so staff can see it
    if (res.changes === 0) {
      const id = 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO inbox_broadcast_logs (id, campaign_id, name, phone, status, gupshup_message_id, error_message, reply_text, created_at)
        VALUES (?, NULL, ?, ?, 'replied', NULL, NULL, ?, ?)
      `);
      insertStmt.run(id, data.name || 'Patient', cleanPhone, data.replyText, now);
    }

    return true;
  } catch (err) {
    console.error('Error recording customer reply in SQLite:', err);
    return false;
  }
}

