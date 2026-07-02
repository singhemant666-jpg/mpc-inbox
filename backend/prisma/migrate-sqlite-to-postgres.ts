import { PrismaClient as SqliteClient } from '../src/generated/sqlite-client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const sqlite = new SqliteClient();
const postgres = new PostgresClient();

async function main() {
  console.log('🔄 Starting migration from SQLite to PostgreSQL...');

  // 1. Migrate Users
  console.log('👥 Migrating Users...');
  const sqliteUsers = await sqlite.user.findMany();
  let userCount = 0;
  for (const user of sqliteUsers) {
    await postgres.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        role: user.role,
        createdAt: user.createdAt,
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
    userCount++;
  }
  console.log(`✅ Migrated ${userCount} users.`);

  // 2. Migrate Conversations
  console.log('💬 Migrating Conversations...');
  const sqliteConversations = await sqlite.conversation.findMany();
  let conversationCount = 0;
  for (const conv of sqliteConversations) {
    await postgres.conversation.upsert({
      where: { phoneNumber: conv.phoneNumber },
      update: {
        patientName: conv.patientName,
        lastMessage: conv.lastMessage,
        lastMessageSender: conv.lastMessageSender,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      },
      create: {
        id: conv.id,
        patientName: conv.patientName,
        phoneNumber: conv.phoneNumber,
        lastMessage: conv.lastMessage,
        lastMessageSender: conv.lastMessageSender,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      },
    });
    conversationCount++;
  }
  console.log(`✅ Migrated ${conversationCount} conversations.`);

  // 3. Migrate Messages
  console.log('✉️ Migrating Messages...');
  const sqliteMessages = await sqlite.message.findMany();
  let messageCount = 0;
  for (const msg of sqliteMessages) {
    // Check if message already exists in PostgreSQL
    const existingMsg = await postgres.message.findUnique({
      where: { id: msg.id },
    });

    if (!existingMsg) {
      await postgres.message.create({
        data: {
          id: msg.id,
          conversationId: msg.conversationId,
          gupshupMessageId: msg.gupshupMessageId,
          senderType: msg.senderType,
          message: msg.message,
          messageType: msg.messageType,
          status: msg.status,
          createdAt: msg.createdAt,
        },
      });
      messageCount++;
    }
  }
  console.log(`✅ Migrated ${messageCount} messages.`);

  // 4. Migrate Templates
  console.log('📋 Migrating Templates...');
  const sqliteTemplates = await sqlite.template.findMany();
  let templateCount = 0;
  for (const temp of sqliteTemplates) {
    // Check if template already exists
    const existingTemp = await postgres.template.findFirst({
      where: { title: temp.title },
    });

    if (!existingTemp) {
      await postgres.template.create({
        data: {
          id: temp.id,
          title: temp.title,
          text: temp.text,
          createdAt: temp.createdAt,
          updatedAt: temp.updatedAt,
        },
      });
      templateCount++;
    }
  }
  console.log(`✅ Migrated ${templateCount} templates.`);

  console.log('🎉 Migration from SQLite to PostgreSQL completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await postgres.$disconnect();
  });
