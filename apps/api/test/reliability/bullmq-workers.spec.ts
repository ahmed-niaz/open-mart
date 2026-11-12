import { describe, expect, it, vi } from 'vitest';
import { BullMqNotificationAdapter } from '../../src/notification/infrastructure/queues/bullmq-notification.adapter.js';
import { NotificationWorkerProcessor } from '../../src/notification/infrastructure/queues/notification-worker.processor.js';
import { BullMqMediaCleanupAdapter } from '../../src/media/infrastructure/queues/bullmq-media-cleanup.adapter.js';
import { MediaCleanupWorkerProcessor } from '../../src/media/infrastructure/queues/media-cleanup-worker.processor.js';
import { DeleteMediaAssetHandler } from '../../src/media/application/commands/delete-media-asset/delete-media-asset.handler.js';
import { DeleteMediaAssetCommand } from '../../src/media/application/commands/delete-media-asset/delete-media-asset.command.js';
import { BulkDeleteMediaHandler } from '../../src/media/application/commands/bulk-delete-media/bulk-delete-media.handler.js';
import { BulkDeleteMediaCommand } from '../../src/media/application/commands/bulk-delete-media/bulk-delete-media.command.js';
import { MediaAsset } from '../../src/media/domain/entities/media-asset.entity.js';
import { MediaId } from '../../src/media/domain/value-objects/media-id.vo.js';
import { QueueConnectionService } from '../../src/shared/infrastructure/queue/queue.service.js';
import { QUEUE_NAMES } from '../../src/shared/infrastructure/queue/queue.constants.js';

describe('Phase 5: BullMQ Asynchronous Worker Isolation', () => {
  function createMockQueueConnection(options?: {
    ready?: boolean;
    runWorkers?: boolean;
    addImpl?: () => Promise<any>;
  }) {
    const mockQueue = {
      add: vi.fn(options?.addImpl ?? (async () => ({ id: 'job-1' }))),
    };
    let capturedProcessor: ((job: any) => Promise<void>) | undefined;
    let capturedQueueName: string | undefined;
    let capturedWorkerOptions: any;

    const connection = {
      isProducerReady: vi.fn(() => options?.ready ?? true),
      shouldRunWorkers: vi.fn(() => options?.runWorkers ?? true),
      getOrCreateQueue: vi.fn(() => mockQueue),
      createWorker: vi.fn((name: string, processor: any, workerOpts?: any) => {
        capturedQueueName = name;
        capturedProcessor = processor;
        capturedWorkerOptions = workerOpts;
        return { close: vi.fn() };
      }),
    };

    return {
      connection,
      mockQueue,
      getCapturedWorker: () => ({
        queueName: capturedQueueName,
        processor: capturedProcessor,
        options: capturedWorkerOptions,
      }),
    };
  }

  describe('Notification Queue Producer & Worker', () => {
    it('enqueues email jobs to BullMQ instead of sending SMTP inline when queue is ready', async () => {
      const { connection, mockQueue } = createMockQueueConnection({
        ready: true,
      });
      const directNotification = { sendEmail: vi.fn() };

      const adapter = new BullMqNotificationAdapter(
        connection as any,
        directNotification,
      );

      const emailPayload = {
        to: 'customer@example.com',
        subject: 'Order Confirmed',
        html: '<p>Confirmed</p>',
      };

      await adapter.sendEmail(emailPayload);

      expect(connection.getOrCreateQueue).toHaveBeenCalledWith(
        QUEUE_NAMES.NOTIFICATIONS,
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('send-email', emailPayload);
      expect(directNotification.sendEmail).not.toHaveBeenCalled();
    });

    it('fails open to inline email delivery when BullMQ Redis is offline or enqueue throws', async () => {
      const { connection } = createMockQueueConnection({ ready: false });
      const directNotification = {
        sendEmail: vi.fn().mockResolvedValue(undefined),
      };

      const adapter = new BullMqNotificationAdapter(
        connection as any,
        directNotification,
      );

      const emailPayload = {
        to: 'customer@example.com',
        subject: 'Payment Receipt',
        html: '<p>Paid</p>',
      };

      await adapter.sendEmail(emailPayload);
      expect(directNotification.sendEmail).toHaveBeenCalledWith(emailPayload);

      // Enqueue error path
      const failingEnqueue = createMockQueueConnection({
        ready: true,
        addImpl: async () => {
          throw new Error('ECONNREFUSED');
        },
      });
      const directNotification2 = {
        sendEmail: vi.fn().mockResolvedValue(undefined),
      };
      const adapter2 = new BullMqNotificationAdapter(
        failingEnqueue.connection as any,
        directNotification2,
      );
      await adapter2.sendEmail(emailPayload);
      expect(directNotification2.sendEmail).toHaveBeenCalledWith(emailPayload);
    });

    it('skips worker registration in API pods when shouldRunWorkers() is false, and runs & rethrows SMTP failures in worker mode', async () => {
      // Isolated API pod mode
      const apiConn = createMockQueueConnection({ runWorkers: false });
      const directApi = { sendEmail: vi.fn() };
      const apiProcessor = new NotificationWorkerProcessor(
        apiConn.connection as any,
        directApi,
      );
      apiProcessor.onModuleInit();
      expect(apiConn.connection.createWorker).not.toHaveBeenCalled();

      // Worker mode
      const workerConn = createMockQueueConnection({ runWorkers: true });
      const smtpError = new Error('SMTP 421 Temporary Rate Limit');
      const directWorker = {
        sendEmail: vi.fn().mockRejectedValueOnce(smtpError),
      };
      const workerProcessor = new NotificationWorkerProcessor(
        workerConn.connection as any,
        directWorker,
      );
      workerProcessor.onModuleInit();

      const registered = workerConn.getCapturedWorker();
      expect(registered.queueName).toBe(QUEUE_NAMES.NOTIFICATIONS);
      expect(registered.options).toEqual({ concurrency: 5 });

      await expect(
        registered.processor!({
          id: 'job-42',
          attemptsMade: 0,
          data: { to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' },
        }),
      ).rejects.toThrow('SMTP 421 Temporary Rate Limit');
    });
  });

  describe('Media Cleanup Queue & Command Integration', () => {
    it('offloads Cloudflare R2 deletion to BullMQ from DeleteMediaAssetHandler and BulkDeleteMediaHandler', async () => {
      const { connection, mockQueue } = createMockQueueConnection({
        ready: true,
      });
      const mockStorage = {
        upload: vi.fn(),
        uploadMany: vi.fn(),
        delete: vi.fn(),
      };
      const mediaCleanup = new BullMqMediaCleanupAdapter(
        connection as any,
        mockStorage,
      );

      const asset1 = MediaAsset.create({
        fileName: 'a.jpg',
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 120,
        url: 'https://cdn.example.com/a.jpg',
        storageKey: 'products/2026/11/a.jpg',
      });
      const asset2 = MediaAsset.create({
        fileName: 'b.jpg',
        originalName: 'b.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 120,
        url: 'https://cdn.example.com/b.jpg',
        storageKey: 'products/2026/11/b.jpg',
      });

      const mockRepo = {
        findById: vi.fn(async (id: MediaId) => {
          if (id.getValue() === asset1.id.getValue()) return asset1;
          if (id.getValue() === asset2.id.getValue()) return asset2;
          return null;
        }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const singleHandler = new DeleteMediaAssetHandler(
        mockRepo as any,
        mockStorage as any,
        mediaCleanup,
      );
      await singleHandler.execute(
        new DeleteMediaAssetCommand(asset1.id.getValue(), false),
      );

      expect(mockRepo.delete).toHaveBeenCalledWith(asset1.id);
      expect(mockStorage.delete).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('delete-storage-object', {
        storageKey: 'products/2026/11/a.jpg',
        mediaId: asset1.id.getValue(),
        reason: 'delete_media_asset',
      });

      const bulkHandler = new BulkDeleteMediaHandler(
        mockRepo as any,
        mockStorage as any,
        mediaCleanup,
      );
      const res = await bulkHandler.execute(
        new BulkDeleteMediaCommand([asset2.id.getValue()], false),
      );

      expect(res.deletedCount).toBe(1);
      expect(mockQueue.add).toHaveBeenCalledWith('delete-storage-object', {
        storageKey: 'products/2026/11/b.jpg',
        mediaId: asset2.id.getValue(),
        reason: 'bulk_delete_media',
      });
    });

    it('processes media cleanup jobs via MediaCleanupWorkerProcessor', async () => {
      const workerConn = createMockQueueConnection({ runWorkers: true });
      const mockStorage = {
        upload: vi.fn(),
        uploadMany: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const processor = new MediaCleanupWorkerProcessor(
        workerConn.connection as any,
        mockStorage as any,
      );
      processor.onModuleInit();

      const registered = workerConn.getCapturedWorker();
      expect(registered.queueName).toBe(QUEUE_NAMES.MEDIA_CLEANUP);

      await registered.processor!({
        id: 'purge-1',
        attemptsMade: 1,
        data: { storageKey: 'products/2026/11/orphan.jpg' },
      });

      expect(mockStorage.delete).toHaveBeenCalledWith(
        'products/2026/11/orphan.jpg',
      );
    });
  });

  describe('QueueConnectionService Worker Mode Controls', () => {
    it('disables embedded workers in production API pods unless forced in WorkerModule', async () => {
      const prevVitest = process.env.VITEST;
      delete process.env.VITEST;

      const buildConfigService = (env: Record<string, string | undefined>) => ({
        get: (key: string, defaultValue?: any) =>
          env[key] !== undefined ? env[key] : defaultValue,
      });

      const apiProdSvc = new QueueConnectionService(
        buildConfigService({ NODE_ENV: 'production' }) as any,
        false,
      );
      const workerProdSvc = new QueueConnectionService(
        buildConfigService({
          NODE_ENV: 'production',
          QUEUE_EMBEDDED_WORKER: 'false',
        }) as any,
        true,
      );

      try {
        expect(apiProdSvc.shouldRunWorkers()).toBe(false);
        expect(workerProdSvc.shouldRunWorkers()).toBe(true);
      } finally {
        process.env.VITEST = prevVitest;
        await Promise.allSettled([
          apiProdSvc.onModuleDestroy(),
          workerProdSvc.onModuleDestroy(),
        ]);
      }
    });
  });
});
