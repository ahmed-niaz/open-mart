import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueConnectionService } from './queue.service.js';
import { FORCE_WORKERS_ENABLED } from './queue.constants.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FORCE_WORKERS_ENABLED,
      useValue: false,
    },
    QueueConnectionService,
  ],
  exports: [QueueConnectionService],
})
export class QueueModule {
  static forWorker(): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: FORCE_WORKERS_ENABLED,
          useValue: true,
        },
        QueueConnectionService,
      ],
      exports: [QueueConnectionService],
    };
  }
}
