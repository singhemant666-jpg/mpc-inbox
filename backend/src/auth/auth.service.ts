import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    console.log('🔄 Verifying/updating Super Admin credentials...');
    try {
      await this.ensureAdminCredentials();
    } catch (e) {
      console.error('Error ensuring Admin credentials on startup:', e);
    }
  }

  async ensureAdminCredentials() {
    // 1. Ensure Standard Clinic Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mypainclnic.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);

    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      await this.prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          email: adminEmail.toLowerCase().trim(),
          password: hashedAdminPassword,
        },
      });
      console.log(`✅ Clinic Admin credentials verified: ${adminEmail}`);
    } else {
      await this.prisma.user.create({
        data: {
          name: process.env.ADMIN_NAME || 'Clinic Admin',
          email: adminEmail.toLowerCase().trim(),
          password: hashedAdminPassword,
          role: 'admin',
        },
      });
      console.log(`✅ Clinic Admin account created: ${adminEmail}`);
    }

    // 2. Ensure Super Admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadminmpc@gmail.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin';
    const hashedSuperPassword = await bcrypt.hash(superAdminPassword, 12);

    const existingSuper = await this.prisma.user.findFirst({
      where: { role: 'super_admin' },
    });

    if (existingSuper) {
      await this.prisma.user.update({
        where: { id: existingSuper.id },
        data: {
          email: superAdminEmail.toLowerCase().trim(),
          password: hashedSuperPassword,
        },
      });
      console.log(`✅ Super Admin credentials verified: ${superAdminEmail}`);
    } else {
      await this.prisma.user.create({
        data: {
          name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
          email: superAdminEmail.toLowerCase().trim(),
          password: hashedSuperPassword,
          role: 'super_admin',
        },
      });
      console.log(`✅ Super Admin account created: ${superAdminEmail}`);
    }
  }

  async login(email: string, password: string) {
    const rawEmail = email.toLowerCase().trim();
    const normalizedEmail = rawEmail.replace('mypainclinic.com', 'mypainclnic.com');
    const altEmail = rawEmail.replace('mypainclnic.com', 'mypainclinic.com');

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: rawEmail },
          { email: normalizedEmail },
          { email: altEmail },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }


    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async seedAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@mypainclnic.com';
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      return { message: 'Admin user already exists', email };
    }

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'admin123',
      12,
    );

    const user = await this.prisma.user.create({
      data: {
        name: process.env.ADMIN_NAME || 'Clinic Admin',
        email,
        password: hashedPassword,
        role: 'admin',
      },
    });

    return {
      message: 'Admin user created successfully',
      email: user.email,
      name: user.name,
    };
  }
}
