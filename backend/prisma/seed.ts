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
