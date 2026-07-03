import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  @IsIn(['text', 'image', 'video', 'document', 'audio'])
  messageType?: string;
}
