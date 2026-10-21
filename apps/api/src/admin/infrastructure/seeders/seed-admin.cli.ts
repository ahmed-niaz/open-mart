import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module.js';
import { InitialAdminSeeder } from './initial-admin.seeder.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const seeder = app.get(InitialAdminSeeder);
  console.log('Running manual Admin Seeder...');
  await seeder.seedInitialSuperAdmin();
  console.log('Admin Seeder finished.');

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Admin Seeder failed:', err);
  process.exit(1);
});
