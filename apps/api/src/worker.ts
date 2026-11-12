import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { QUEUE_NAMES } from './shared/infrastructure/queue/queue.constants.js';

async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('BullMQWorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableShutdownHooks();

  logger.log(
    `OPEN-MART isolated BullMQ worker active (queues: ${Object.values(QUEUE_NAMES).join(', ')})`,
  );
}

await bootstrapWorker();
