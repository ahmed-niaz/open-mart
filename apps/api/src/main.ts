import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ApplicationExceptionFilter } from './shared/infrastructure/filters/application-exception.filters.js';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filters.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

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