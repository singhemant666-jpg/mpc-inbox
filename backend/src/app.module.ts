import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { GatewayModule } from './gateway/gateway.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';

import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    WebhookModule,
    ConversationsModule,
    MessagesModule,
    GatewayModule,
    TemplatesModule,
    UsersModule,
  ],
})
export class AppModule {}
