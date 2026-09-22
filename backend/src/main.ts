import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded public files
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });

  // Global prefix for all API routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend (allow tunnel URLs for demos)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 MPC Inbox Backend running on http://0.0.0.0:${port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${port}/api/webhook/gupshup`);
}
bootstrap();
