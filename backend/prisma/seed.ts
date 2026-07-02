import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'admin123',
    12,
  );

  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@mypainclnic.com' },
    update: {},
    create: {
      name: process.env.ADMIN_NAME || 'Clinic Admin',
      email: process.env.ADMIN_EMAIL || 'admin@mypainclnic.com',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Delete the mock demo conversations if they exist
  const deleteResult = await prisma.conversation.deleteMany({
    where: {
      phoneNumber: {
        in: [
          '919876543210',
          '919876543211',
          '919876543212',
          '919876543213',
          '919876543214',
        ],
      },
    },
  });

  if (deleteResult.count > 0) {
    console.log(`🧹 Deleted ${deleteResult.count} demo conversations`);
  }

  // Seed default templates
  const defaultTemplates = [
    {
      title: '📅 Appointment Confirmation',
      text: 'Hi [Patient Name],\n\nYour appointment at My Pain Clinic is confirmed for [Date] at [Time].\nBooking ID: [Booking ID].\nPlease arrive 10 minutes early.\n\n📍 Maps Link: B-1, V. N. Sphere Mall, Linking Road, Bandra (W), Mumbai - 400050\n📞 For queries, contact: +91 8169400905',
    },
    {
      title: '📍 Clinic Location & Address',
      text: '📍 My Pain Clinic Location Details:\n\nAddress: B-1, V. N. Sphere Mall, Linking Road, Bandra (W), Mumbai - 400050.\nMaps Link: https://maps.app.goo.gl/y3hF5\nPhone: +91 8169400905',
    },
    {
      title: '🩺 Cervical / Back Pain Info',
      text: 'Hi [Patient Name],\n\nFor cervical/back pain, we offer specialized consultations with Dr. Shah, including advanced physiotherapy and targeted pain-relief therapies.\n\nWould you like to schedule an assessment this week?',
    },
    {
      title: '👋 General Greeting',
      text: 'Hello, thank you for contacting My Pain Clinic. How can we help you today?',
    },
    {
      title: '💊 Session Follow-up',
      text: 'Hi [Patient Name],\n\nHope you are feeling better after your session. Please let us know if your pain has reduced or if you would like to book your next follow-up appointment.',
    },
  ];

  // Let's check: if table is empty, create them:
  const templateCount = await prisma.template.count();
  if (templateCount === 0) {
    for (const t of defaultTemplates) {
      await prisma.template.create({ data: t });
    }
    console.log(`✅ Seeded ${defaultTemplates.length} default templates`);
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
