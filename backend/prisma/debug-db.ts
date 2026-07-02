import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const convs = await prisma.conversation.findMany({
    select: {
      id: true,
      patientName: true,
      phoneNumber: true,
      conversationType: true,
      assignedUserId: true,
      assignedUser: {
        select: {
          email: true,
        },
      },
    },
  });

  console.log('--- ALL CONVERSATIONS ---');
  for (const c of convs) {
    console.log(
      `- ${c.patientName} (${c.phoneNumber}): type=${c.conversationType}, assignedUserId=${c.assignedUserId} (${c.assignedUser?.email || 'NONE'})`,
    );
  }
}

main().finally(() => prisma.$disconnect());
