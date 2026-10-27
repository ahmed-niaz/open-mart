import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { ApplicationExceptionFilter } from './shared/infrastructure/filters/application-exception.filters.js';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filters.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // 1. HTTP Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 2. Request Payload Size Limits (3MB) using NestJS native Express body parser
  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '3mb' });

  // 3. Graceful Shutdown Hooks (allows SIGTERM to drain DB queries & transactions)
  app.enableShutdownHooks();

  // 4. Dynamic Environment-Driven CORS
  const configuredCors = configService.get<string>('CORS_ORIGINS');
  const allowedOrigins = configuredCors
    ? configuredCors
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // 5. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 6. Standardized Exception Filters
  app.useGlobalFilters(
    new ApplicationExceptionFilter(),
    new DomainExceptionFilter(),
  );

  const port = configService.get<number>('PORT') ?? 3001;
  await app.listen(port);
}

await bootstrap();
