import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Same phrases used in webhook.service.ts
const NEW_LEAD_PHRASES = [
  'Hello! Can I get more info on this?',
  "Hi, I'd like to book a consultation.",
  '[button_reply]',
];

function isNewLead(messageText: string): boolean {
  const normalized = messageText.trim().toLowerCase();
  return NEW_LEAD_PHRASES.some(
    (phrase) => normalized === phrase.toLowerCase(),
  );
}

async function main() {
  console.log('🔄 Classifying existing conversations...');

  // Look up user IDs for assignment
  const leadsUser = await prisma.user.findUnique({
    where: { email: 'leads@mypainclnic.com' },
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@mypainclnic.com' },
  });

  if (!leadsUser) {
    console.error('❌ Leads user (leads@mypainclnic.com) not found. Run "npm run seed" first.');
    process.exit(1);
  }
  if (!adminUser) {
    console.error('❌ Admin user (admin@mypainclnic.com) not found. Run "npm run seed" first.');
    process.exit(1);
  }

  console.log(`📋 Leads user: ${leadsUser.email} (${leadsUser.id})`);
  console.log(`📋 Admin user: ${adminUser.email} (${adminUser.id})`);

  // Get all conversations
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 Found ${conversations.length} conversations to classify.`);

  let newLeadCount = 0;
  let existingPatientCount = 0;

  for (const conv of conversations) {
    // Find the FIRST message in this conversation (oldest)
    const firstMessage = await prisma.message.findFirst({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
    });

    let conversationType = 'existing_patient';
    let assignedUserId = adminUser.id;

    if (firstMessage && isNewLead(firstMessage.message)) {
      conversationType = 'new_lead';
      assignedUserId = leadsUser.id;
      newLeadCount++;
    } else {
      existingPatientCount++;
    }

    // Update the conversation
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        conversationType,
        assignedUserId,
      },
    });

    console.log(
      `  ${conversationType === 'new_lead' ? '🆕' : '👤'} ${conv.patientName} (${conv.phoneNumber}) → ${conversationType}`,
    );
  }

  console.log('\n✅ Classification complete!');
  console.log(`  🆕 New Leads: ${newLeadCount}`);
  console.log(`  👤 Existing Patients: ${existingPatientCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Classification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
