import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DrizzleProductMediaSyncAdapter } from '../../src/product/infrastructure/adapters/drizzle-product-media-sync.adapter.js';
import { DrizzleProductMediaDetacherAdapter } from '../../src/media/infrastructure/adapters/drizzle-product-media-detacher.adapter.js';
import type { StoragePort } from '../../src/shared/application/ports/storage.port.js';
import type { CacheService } from '../../src/shared/infrastructure/cache/cache.service.js';

describe('Product Media Synchronization & Detaching Tests', () => {
  describe('DrizzleProductMediaSyncAdapter', () => {
    let mockStorageService: StoragePort;
    let mockDb: any;
    let adapter: DrizzleProductMediaSyncAdapter;

    beforeEach(() => {
      mockStorageService = {
        upload: vi.fn().mockResolvedValue({
          url: 'https://cdn.openmart.com/products/2026/11/speaker-front.jpg',
          key: 'products/2026/11/speaker-front.jpg',
          fileName: 'speaker-front.jpg',
        }),
        uploadMany: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      adapter = new DrizzleProductMediaSyncAdapter(
        mockStorageService,
        mockDb as any,
      );
    });

    it('uploadAndRegisterMedia uploads to R2 and inserts into media_assets with usageCount = 1', async () => {
      const files = [
        {
          buffer: Buffer.from('image-binary'),
          originalName: 'speaker-front.jpg',
          mimeType: 'image/jpeg',
          size: 2048,
          folder: 'products',
          altText: 'Smart Bluetooth Speaker',
        },
      ];

      const results = await adapter.uploadAndRegisterMedia(files);

      expect(mockStorageService.upload).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        url: 'https://cdn.openmart.com/products/2026/11/speaker-front.jpg',
        storageKey: 'products/2026/11/speaker-front.jpg',
        fileName: 'speaker-front.jpg',
        altText: 'Smart Bluetooth Speaker',
      });
    });

    it('syncMediaUsage handles added and removed URLs correctly', async () => {
      const currentUrls = [
        'https://cdn.openmart.com/products/2026/11/new-angle.jpg',
      ];
      const previousUrls = [
        'https://cdn.openmart.com/products/2026/11/old-angle.jpg',
      ];

      await adapter.syncMediaUsage(currentUrls, previousUrls, 'Product Title');

      // Update called for decremented removed URL
      expect(mockDb.update).toHaveBeenCalled();
      // Insert called for newly added URL
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('DrizzleProductMediaDetacherAdapter', () => {
    let mockDb: any;
    let mockCacheService: Partial<CacheService>;
    let detacher: DrizzleProductMediaDetacherAdapter;

    beforeEach(() => {
      mockCacheService = {
        del: vi.fn().mockResolvedValue(undefined),
        delPattern: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('detaches deleted media URL from product galleries and variants, updating DB and cache', async () => {
      const deletedUrl =
        'https://cdn.openmart.com/products/2026/11/deleted-image.jpg';

      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-PROD-1',
          media: [
            {
              url: deletedUrl,
              altText: 'Deleted Thumb',
              isThumbnail: true,
            },
            {
              url: 'https://cdn.openmart.com/products/2026/11/kept-image.jpg',
              altText: 'Kept Image',
              isThumbnail: false,
            },
          ],
          variants: [
            {
              id: 'v1',
              sku: 'SKU-PROD-1-RED',
              imageUrl: deletedUrl,
            },
          ],
        },
      ];

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockResolvedValue(mockProducts),
        }),
        update: vi.fn().mockReturnValue({
          set: mockUpdateSet,
        }),
      };

      detacher = new DrizzleProductMediaDetacherAdapter(
        mockDb as any,
        mockCacheService as CacheService,
      );

      const affected = await detacher.detachMediaUrlsFromAllProducts([
        deletedUrl,
      ]);

      expect(affected).toBe(1);
      expect(mockDb.update).toHaveBeenCalledTimes(1);

      // Verify that the set payload removed the deleted URL and promoted the kept image to isThumbnail: true
      const updateArgs = mockUpdateSet.mock.calls[0][0];
      expect(updateArgs.media).toEqual([
        {
          url: 'https://cdn.openmart.com/products/2026/11/kept-image.jpg',
          altText: 'Kept Image',
          isThumbnail: true,
        },
      ]);
      expect(updateArgs.variants[0].imageUrl).toBeUndefined();

      // Verify cache invalidation
      expect(mockCacheService.del).toHaveBeenCalledWith('product:id:prod-1');
      expect(mockCacheService.del).toHaveBeenCalledWith(
        'product:sku:SKU-PROD-1',
      );
      expect(mockCacheService.delPattern).toHaveBeenCalledWith(
        'product:list:*',
      );
    });

    it('returns 0 and performs no updates if no products reference the deleted media', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockResolvedValue([
            {
              id: 'prod-2',
              sku: 'SKU-2',
              media: [
                {
                  url: 'https://cdn.openmart.com/products/2026/11/unrelated.jpg',
                  isThumbnail: true,
                },
              ],
              variants: [],
            },
          ]),
        }),
        update: vi.fn(),
      };

      detacher = new DrizzleProductMediaDetacherAdapter(
        mockDb as any,
        mockCacheService as CacheService,
      );

      const affected = await detacher.detachMediaUrlsFromAllProducts([
        'https://cdn.openmart.com/media/random.jpg',
      ]);

      expect(affected).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockCacheService.del).not.toHaveBeenCalled();
    });
  });
});
