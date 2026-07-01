import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { GupshupService } from './gupshup.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [MessagesController],
  providers: [MessagesService, GupshupService],
  exports: [MessagesService],
})
export class MessagesModule {}
