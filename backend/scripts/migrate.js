const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

const sqlitePath = path.join(__dirname, '..', 'prisma', 'dev.db');
const pgUrl = 'postgresql://postgres.pnmndmrmzokhtdchrgyh:sahilsingh1%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('🔄 Opening SQLite database:', sqlitePath);
  const db = new sqlite3.Database(sqlitePath);

  const querySqlite = (sql) => new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log('🔌 Connecting to Supabase PostgreSQL...');
  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();
  console.log('✅ Connected to Supabase PostgreSQL');

  // 1. Migrate Users (with original IDs so foreign keys match)
  const users = await querySqlite('SELECT * FROM inbox_users');
  console.log(`📦 Migrating ${users.length} users...`);
  await pg.query('DELETE FROM inbox_users');
  for (const u of users) {
    await pg.query(
      `INSERT INTO inbox_users (id, name, email, password, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = EXCLUDED.role;`,
      [u.id, u.name, u.email, u.password, u.role, new Date(u.created_at || Date.now())]
    );
  }

  // 2. Migrate Conversations
  const conversations = await querySqlite('SELECT * FROM inbox_conversations');
  console.log(`📦 Migrating ${conversations.length} conversations...`);
  for (const c of conversations) {
    await pg.query(
      `INSERT INTO inbox_conversations (id, patient_name, phone_number, conversation_type, assigned_user_id, last_message, last_message_sender, last_message_time, unread_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         patient_name = EXCLUDED.patient_name,
         phone_number = EXCLUDED.phone_number,
         conversation_type = EXCLUDED.conversation_type,
         assigned_user_id = EXCLUDED.assigned_user_id,
         last_message = EXCLUDED.last_message,
         last_message_sender = EXCLUDED.last_message_sender,
         last_message_time = EXCLUDED.last_message_time,
         unread_count = EXCLUDED.unread_count,
         updated_at = EXCLUDED.updated_at;`,
      [
        c.id,
        c.patient_name,
        c.phone_number,
        c.conversation_type,
        c.assigned_user_id,
        c.last_message,
        c.last_message_sender,
        c.last_message_time ? new Date(c.last_message_time) : null,
        c.unread_count || 0,
        new Date(c.created_at || Date.now()),
        new Date(c.updated_at || Date.now()),
      ]
    );
  }

  // 3. Migrate Messages
  const messages = await querySqlite('SELECT * FROM inbox_messages');
  console.log(`📦 Migrating ${messages.length} messages...`);
  for (const m of messages) {
    await pg.query(
      `INSERT INTO inbox_messages (id, conversation_id, gupshup_message_id, sender_type, message, message_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         message = EXCLUDED.message;`,
      [
        m.id,
        m.conversation_id,
        m.gupshup_message_id,
        m.sender_type,
        m.message,
        m.message_type || 'text',
        m.status || 'sent',
        new Date(m.created_at || Date.now()),
      ]
    );
  }

  // 4. Migrate Templates
  const templates = await querySqlite('SELECT * FROM inbox_templates');
  console.log(`📦 Migrating ${templates.length} templates...`);
  for (const t of templates) {
    await pg.query(
      `INSERT INTO inbox_templates (id, title, text, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING;`,
      [t.id, t.title, t.text, new Date(t.created_at || Date.now()), new Date(t.updated_at || Date.now())]
    );
  }

  // 5. Migrate Broadcast Campaigns
  try {
    const campaigns = await querySqlite('SELECT * FROM inbox_broadcast_campaigns');
    console.log(`📦 Migrating ${campaigns.length} broadcast campaigns...`);
    for (const cmp of campaigns) {
      await pg.query(
        `INSERT INTO inbox_broadcast_campaigns (id, template_id, template_name, total_count, success_count, failed_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [cmp.id, cmp.template_id, cmp.template_name, cmp.total_count, cmp.success_count, cmp.failed_count, new Date(cmp.created_at || Date.now())]
      );
    }
  } catch (e) {
    console.log('No broadcast campaigns found in SQLite');
  }

  // 6. Migrate Broadcast Logs
  try {
    const logs = await querySqlite('SELECT * FROM inbox_broadcast_logs');
    console.log(`📦 Migrating ${logs.length} broadcast logs...`);
    for (const l of logs) {
      await pg.query(
        `INSERT INTO inbox_broadcast_logs (id, campaign_id, name, phone, status, gupshup_message_id, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING;`,
        [l.id, l.campaign_id, l.name, l.phone, l.status, l.gupshup_message_id, l.error_message, new Date(l.created_at || Date.now())]
      );
    }
  } catch (e) {
    console.log('No broadcast logs found in SQLite');
  }

  await pg.end();
  db.close();
  console.log('🎉 Migration to Supabase PostgreSQL completed successfully!');
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
