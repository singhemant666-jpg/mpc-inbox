import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async create(data: { title: string; text: string }) {
    return this.prisma.template.create({
      data: {
        title: data.title,
        text: data.text,
      },
    });
  }

  async update(id: string, data: { title?: string; text?: string }) {
    await this.findOne(id); // Throws if not found
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Throws if not found
    return this.prisma.template.delete({
      where: { id },
    });
  }
}
