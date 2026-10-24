import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ApplicationExceptionFilter } from './shared/infrastructure/filters/application-exception.filters.js';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filters.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new ApplicationExceptionFilter(),
    new DomainExceptionFilter(),
  );
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
