import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { GatewayModule } from './gateway/gateway.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WebhookModule,
    ConversationsModule,
    MessagesModule,
    GatewayModule,
    TemplatesModule,
  ],
})
export class AppModule {}
