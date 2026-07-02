import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const conversations = await prisma.conversation.findMany({
    take: 5,
    orderBy: { lastMessageTime: 'desc' },
  });

  console.log('=== LATEST CONVERSATIONS IN DB ===');
  conversations.forEach((c) => {
    console.log({
      id: c.id,
      patientName: c.patientName,
      phoneNumber: c.phoneNumber,
      lastMessage: c.lastMessage,
      lastMessageSender: (c as any).lastMessageSender,
      unreadCount: c.unreadCount,
    });
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
