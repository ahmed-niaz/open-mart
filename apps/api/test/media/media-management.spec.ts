import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaAsset } from '../../src/media/domain/entities/media-asset.entity.js';
import { MediaId } from '../../src/media/domain/value-objects/media-id.vo.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';
import { UploadMediaHandler } from '../../src/media/application/commands/upload-media/upload-media.handler.js';
import { UploadMediaCommand } from '../../src/media/application/commands/upload-media/upload-media.command.js';
import { UpdateMediaMetadataHandler } from '../../src/media/application/commands/update-media-metadata/update-media-metadata.handler.js';
import { UpdateMediaMetadataCommand } from '../../src/media/application/commands/update-media-metadata/update-media-metadata.command.js';
import { DeleteMediaAssetHandler } from '../../src/media/application/commands/delete-media-asset/delete-media-asset.handler.js';
import { DeleteMediaAssetCommand } from '../../src/media/application/commands/delete-media-asset/delete-media-asset.command.js';
import { BulkDeleteMediaHandler } from '../../src/media/application/commands/bulk-delete-media/bulk-delete-media.handler.js';
import { BulkDeleteMediaCommand } from '../../src/media/application/commands/bulk-delete-media/bulk-delete-media.command.js';
import { DeleteProductMediaHandler } from '../../src/product/application/use-cases/delete-product-media/delete-product-media.handler.js';
import { DeleteProductMediaCommand } from '../../src/product/application/use-cases/delete-product-media/delete-product-media.command.js';
import { ApplicationException } from '../../src/shared/domain/exceptions/application.exception.js';

describe('Centralized Media Management Module', () => {
  describe('MediaAsset Aggregate Root (Domain)', () => {
    it('creates a valid MediaAsset with defaults', () => {
      const asset = MediaAsset.create({
        fileName: 'test-image.jpg',
        originalName: 'My Photo.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 102400,
        url: 'https://cdn.example.com/products/test-image.jpg',
        storageKey: 'products/test-image.jpg',
        uploadedBy: 'admin-123',
      });

      expect(asset.id).toBeInstanceOf(MediaId);
      expect(asset.fileName).toBe('test-image.jpg');
      expect(asset.originalName).toBe('My Photo.jpg');
      expect(asset.fileSizeBytes).toBe(102400);
      expect(asset.usageCount).toBe(0);
      expect(asset.isArchived).toBe(false);
      expect(asset.version).toBe(1);
    });

    it('throws DomainException if required fields are missing', () => {
      expect(() =>
        MediaAsset.create({
          fileName: '',
          originalName: 'test.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 100,
          url: 'https://cdn.com/test.jpg',
          storageKey: 'key',
        }),
      ).toThrow(DomainException);

      expect(() =>
        MediaAsset.create({
          fileName: 'test.jpg',
          originalName: 'test.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 100,
          url: '',
          storageKey: 'key',
        }),
      ).toThrow(DomainException);
    });

    it('updates metadata and enforces OCC versioning', () => {
      const asset = MediaAsset.create({
        fileName: 't.jpg',
        originalName: 'orig.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 500,
        url: 'https://cdn.com/t.jpg',
        storageKey: 't.jpg',
      });

      asset.updateMetadata({
        altText: 'Banner Image',
        originalName: 'New Name.jpg',
      });
      expect(asset.altText).toBe('Banner Image');
      expect(asset.originalName).toBe('New Name.jpg');

      expect(asset.version).toBe(1);
      asset.incrementVersion();
      expect(asset.version).toBe(2);
    });

    it('increments and decrements usage count safely', () => {
      const asset = MediaAsset.create({
        fileName: 't.jpg',
        originalName: 'orig.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 500,
        url: 'https://cdn.com/t.jpg',
        storageKey: 't.jpg',
      });

      asset.incrementUsage();
      asset.incrementUsage();
      expect(asset.usageCount).toBe(2);

      asset.decrementUsage();
      expect(asset.usageCount).toBe(1);

      asset.decrementUsage();
      asset.decrementUsage(); // Should not go below 0
      expect(asset.usageCount).toBe(0);
    });
  });

  describe('Application Commands', () => {
    let mockMediaRepo: {
      findById: ReturnType<typeof vi.fn>;
      findByStorageKey: ReturnType<typeof vi.fn>;
      findByUrl: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };

    let mockStorageService: {
      upload: ReturnType<typeof vi.fn>;
      uploadMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockMediaRepo = {
        findById: vi.fn(),
        findByStorageKey: vi.fn(),
        findByUrl: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue(undefined),
      };

      mockStorageService = {
        upload: vi.fn().mockResolvedValue({
          url: 'https://cdn.openmart.com/media/file-1.png',
          key: 'media/file-1.png',
          fileName: 'file-1.png',
        }),
        uploadMany: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('UploadMediaHandler: uploads file to R2 and saves to Media repository', async () => {
      const handler = new UploadMediaHandler(
        mockMediaRepo as any,
        mockStorageService as any,
      );

      const command = new UploadMediaCommand(
        [
          {
            buffer: Buffer.from('fake-data'),
            originalName: 'Product-Front.png',
            mimeType: 'image/png',
            size: 4096,
          },
        ],
        'products',
        'admin-uuid',
      );

      const result = await handler.execute(command);

      expect(mockStorageService.upload).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        originalName: 'Product-Front.png',
        mimeType: 'image/png',
        folder: 'products',
      });

      expect(mockMediaRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].originalName).toBe('Product-Front.png');
      expect(result[0].url).toBe('https://cdn.openmart.com/media/file-1.png');
      expect(result[0].uploadedBy).toBe('admin-uuid');
    });

    it('UpdateMediaMetadataHandler: updates altText and originalName', async () => {
      const existing = MediaAsset.create({
        fileName: 'f.jpg',
        originalName: 'f.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 100,
        url: 'https://cdn.com/f.jpg',
        storageKey: 'key-f',
      });

      mockMediaRepo.findById.mockResolvedValue(existing);

      const handler = new UpdateMediaMetadataHandler(mockMediaRepo as any);
      const res = await handler.execute(
        new UpdateMediaMetadataCommand(
          existing.id.getValue(),
          'Alt text for SEO',
          'Renamed.jpg',
        ),
      );

      expect(mockMediaRepo.save).toHaveBeenCalledWith(existing);
      expect(res.altText).toBe('Alt text for SEO');
      expect(res.originalName).toBe('Renamed.jpg');
    });

    it('DeleteMediaAssetHandler: rejects permanent delete if asset is linked to products and force=false', async () => {
      const existing = MediaAsset.create({
        fileName: 'in-use.jpg',
        originalName: 'in-use.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 200,
        url: 'https://cdn.com/in-use.jpg',
        storageKey: 'key-in-use',
      });
      existing.incrementUsage(); // usageCount = 1

      mockMediaRepo.findById.mockResolvedValue(existing);

      const handler = new DeleteMediaAssetHandler(
        mockMediaRepo as any,
        mockStorageService as any,
      );

      await expect(
        handler.execute(
          new DeleteMediaAssetCommand(existing.id.getValue(), false),
        ),
      ).rejects.toThrow(ApplicationException);

      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockMediaRepo.delete).not.toHaveBeenCalled();
    });

    it('DeleteMediaAssetHandler: permanently purges from R2 and DB if force=true', async () => {
      const existing = MediaAsset.create({
        fileName: 'in-use.jpg',
        originalName: 'in-use.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 200,
        url: 'https://cdn.com/in-use.jpg',
        storageKey: 'key-in-use',
      });
      existing.incrementUsage();

      mockMediaRepo.findById.mockResolvedValue(existing);

      const handler = new DeleteMediaAssetHandler(
        mockMediaRepo as any,
        mockStorageService as any,
      );

      await handler.execute(
        new DeleteMediaAssetCommand(existing.id.getValue(), true),
      );

      expect(mockStorageService.delete).toHaveBeenCalledWith('key-in-use');
      expect(mockMediaRepo.delete).toHaveBeenCalledWith(existing.id);
    });

    it('BulkDeleteMediaHandler: deletes eligible assets and skips in-use assets when force=false', async () => {
      const unusedAsset = MediaAsset.create({
        fileName: 'unused.jpg',
        originalName: 'unused.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 100,
        url: 'https://cdn.com/unused.jpg',
        storageKey: 'key-unused',
      });

      const inUseAsset = MediaAsset.create({
        fileName: 'used.jpg',
        originalName: 'used.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 100,
        url: 'https://cdn.com/used.jpg',
        storageKey: 'key-used',
      });
      inUseAsset.incrementUsage();

      mockMediaRepo.findById.mockImplementation(async (id: MediaId) => {
        if (id.getValue() === unusedAsset.id.getValue()) return unusedAsset;
        if (id.getValue() === inUseAsset.id.getValue()) return inUseAsset;
        return null;
      });

      const handler = new BulkDeleteMediaHandler(
        mockMediaRepo as any,
        mockStorageService as any,
      );

      const result = await handler.execute(
        new BulkDeleteMediaCommand(
          [unusedAsset.id.getValue(), inUseAsset.id.getValue()],
          false,
        ),
      );

      expect(result.deletedCount).toBe(1);
      expect(mockStorageService.delete).toHaveBeenCalledWith('key-unused');
      expect(mockStorageService.delete).not.toHaveBeenCalledWith('key-used');
    });

    it('DeleteProductMediaHandler: ONLY detaches reference from Product, NEVER calls StoragePort.delete', async () => {
      const mockProduct = {
        id: { getValue: () => 'prod-123' },
        removeMedia: vi.fn(),
      };

      const mockProductRepo = {
        findById: vi.fn().mockResolvedValue(mockProduct),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const handler = new DeleteProductMediaHandler(mockProductRepo as any);

      await handler.execute(
        new DeleteProductMediaCommand(
          'prod-123',
          'https://cdn.openmart.com/media/file.png',
        ),
      );

      expect(mockProduct.removeMedia).toHaveBeenCalledWith(
        'https://cdn.openmart.com/media/file.png',
      );
      expect(mockProductRepo.save).toHaveBeenCalledWith(mockProduct);
      // Confirmed: No StorageService is injected or invoked!
    });
  });
});
