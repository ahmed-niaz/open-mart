import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { StorageModule } from '../shared/infrastructure/storage/storage.module.js';

import { MEDIA_REPOSITORY } from './application/ports/media.repository.js';
import { MEDIA_CLEANUP_PORT } from './application/ports/media-cleanup.port.js';
import { PRODUCT_MEDIA_DETACHER_PORT } from './application/ports/product-media-detacher.port.js';
import { DrizzleMediaRepository } from './infrastructure/adapters/drizzle-media.repository.js';
import { BullMqMediaCleanupAdapter } from './infrastructure/queues/bullmq-media-cleanup.adapter.js';
import { DrizzleProductMediaDetacherAdapter } from './infrastructure/adapters/drizzle-product-media-detacher.adapter.js';
import { MediaCleanupWorkerProcessor } from './infrastructure/queues/media-cleanup-worker.processor.js';

import { UploadMediaHandler } from './application/commands/upload-media/upload-media.handler.js';
import { UpdateMediaMetadataHandler } from './application/commands/update-media-metadata/update-media-metadata.handler.js';
import { DeleteMediaAssetHandler } from './application/commands/delete-media-asset/delete-media-asset.handler.js';
import { BulkDeleteMediaHandler } from './application/commands/bulk-delete-media/bulk-delete-media.handler.js';

import { ListMediaHandler } from './application/queries/list-media/list-media.handler.js';
import { GetMediaSummaryHandler } from './application/queries/get-media-summary/get-media-summary.handler.js';
import { GetMediaByIdHandler } from './application/queries/get-media-by-id/get-media-by-id.handler.js';

import { MediaAdminController } from './presentation/media-admin.controller.js';

const CommandHandlers = [
  UploadMediaHandler,
  UpdateMediaMetadataHandler,
  DeleteMediaAssetHandler,
  BulkDeleteMediaHandler,
];

const QueryHandlers = [
  ListMediaHandler,
  GetMediaSummaryHandler,
  GetMediaByIdHandler,
];

@Module({
  imports: [CqrsModule, StorageModule],
  controllers: [MediaAdminController],
  providers: [
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
    {
      provide: MEDIA_CLEANUP_PORT,
      useClass: BullMqMediaCleanupAdapter,
    },
    {
      provide: PRODUCT_MEDIA_DETACHER_PORT,
      useClass: DrizzleProductMediaDetacherAdapter,
    },
    MediaCleanupWorkerProcessor,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [MEDIA_REPOSITORY, MEDIA_CLEANUP_PORT, PRODUCT_MEDIA_DETACHER_PORT],
})
export class MediaModule {}
