import { Global, Module } from '@nestjs/common';
import { STORAGE_SERVICE } from '../../application/ports/storage.port.js';
import { CloudflareR2StorageAdapter } from './cloudflare-r2.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: CloudflareR2StorageAdapter,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
