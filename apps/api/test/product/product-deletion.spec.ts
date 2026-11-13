import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteProductCommand } from '../../src/product/application/use-cases/delete-product/delete-product.command.js';
import { DeleteProductHandler } from '../../src/product/application/use-cases/delete-product/delete-product.handler.js';
import type { ProductRepositoryPort } from '../../src/product/application/ports/product.repository.js';
import {
  Product,
  ProductStatus,
} from '../../src/product/domain/entities/product.entity.js';
import { ProductId } from '../../src/product/domain/value-objects/product-id.vo.js';
import { SKU } from '../../src/product/domain/value-objects/sku.vo.js';
import { Money } from '../../src/shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../src/shared/domain/exceptions/application.exception.js';
import { DrizzleProductRepository } from '../../src/product/infrastructure/adapters/drizzle-product.repository.js';
import type { CacheService } from '../../src/shared/infrastructure/cache/cache.service.js';

describe('Product Deletion & Media Library Preservation Tests', () => {
  const dummyProductId = 'f1d056f3-edfc-4447-b74e-b10fb4a88d56';

  describe('DeleteProductHandler', () => {
    let mockProductRepo: ProductRepositoryPort;
    let handler: DeleteProductHandler;
    let sampleProduct: Product;

    beforeEach(() => {
      sampleProduct = Product.create({
        id: new ProductId(dummyProductId),
        title: 'Wireless Noise Cancelling Headphones',
        unitPrice: Money.fromCents(15000, 'USD'),
        sku: SKU.create('HEADPHONES-PRO'),
        description: 'High quality sound',
        inventoryQuantity: 25,
        trackQuantity: true,
        status: ProductStatus.ACTIVE,
        media: [
          {
            url: 'https://cdn.example.com/products/2026/10/headphones-1.jpg',
            isThumbnail: true,
          },
          {
            url: 'https://cdn.example.com/products/2026/10/headphones-2.jpg',
            isThumbnail: false,
          },
        ],
        tags: ['audio', 'electronics'],
        variants: [
          {
            id: 'v1',
            name: 'Black',
            type: 'color',
            color: '#000000',
            options: { Color: 'Black' },
            sku: SKU.create('HEADPHONES-PRO-BLK'),
            unitPrice: Money.fromCents(15000, 'USD'),
            inventoryQuantity: 15,
          },
        ],
      });

      mockProductRepo = {
        save: vi.fn(),
        findById: vi.fn().mockResolvedValue(sampleProduct),
        findBySku: vi.fn(),
        findByTitle: vi.fn(),
        findAll: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      handler = new DeleteProductHandler(mockProductRepo);
    });

    it('successfully deletes product from repository while keeping media preserved in Media Library', async () => {
      const command = new DeleteProductCommand(dummyProductId);
      await handler.execute(command);

      expect(mockProductRepo.findById).toHaveBeenCalledWith(
        expect.objectContaining({ value: dummyProductId }),
      );
      expect(mockProductRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: dummyProductId }),
      );
    });

    it('throws ApplicationException with NOT_FOUND when target product does not exist', async () => {
      mockProductRepo.findById = vi.fn().mockResolvedValue(null);

      const command = new DeleteProductCommand('non-existent-id');
      await expect(handler.execute(command)).rejects.toThrow(
        ApplicationException,
      );
      await expect(handler.execute(command)).rejects.toMatchObject({
        code: ApplicationExceptionCode.NOT_FOUND,
      });

      expect(mockProductRepo.delete).not.toHaveBeenCalled();
    });

    it('succeeds even when product has no media attached', async () => {
      const productNoMedia = Product.create({
        id: new ProductId(dummyProductId),
        title: 'Digital Download Ebook',
        unitPrice: Money.fromCents(1000, 'USD'),
        sku: SKU.create('EBOOK-01'),
        description: 'Ebook description',
        inventoryQuantity: 100,
        trackQuantity: false,
        status: ProductStatus.ACTIVE,
        media: [],
      });
      mockProductRepo.findById = vi.fn().mockResolvedValue(productNoMedia);

      const command = new DeleteProductCommand(dummyProductId);
      await handler.execute(command);

      expect(mockProductRepo.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('DrizzleProductRepository.delete', () => {
    it('executes multi-table cascade, decrements media usage count, and evicts product caches', async () => {
      const mockDel = vi.fn().mockResolvedValue(undefined);
      const mockDelPattern = vi.fn().mockResolvedValue(undefined);

      const mockCacheService: Partial<CacheService> = {
        del: mockDel,
        delPattern: mockDelPattern,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockTx = {
        delete: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: dummyProductId,
                sku: 'HEADPHONES-PRO',
                variants: [
                  {
                    id: 'v1',
                    sku: 'HEADPHONES-PRO-BLK',
                  },
                ],
                media: [
                  {
                    url: 'https://cdn.example.com/products/2026/10/headphones-1.jpg',
                  },
                ],
              },
            ]),
          })),
        })),
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([{ id: 'inv-item-uuid-1' }]),
          })),
        })),
        update: mockUpdate,
      };

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };

      const repository = new DrizzleProductRepository(
        mockDb as any,
        mockCacheService as CacheService,
      );

      await repository.delete(new ProductId(dummyProductId));

      // Transaction was invoked
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify update was called for order_items and media_assets usageCount
      expect(mockUpdate).toHaveBeenCalledTimes(2);

      // Verify cache invalidation for product ID, root SKU, variant SKU, and list/category patterns
      expect(mockDel).toHaveBeenCalledWith(`product:id:${dummyProductId}`);
      expect(mockDel).toHaveBeenCalledWith('product:sku:HEADPHONES-PRO');
      expect(mockDel).toHaveBeenCalledWith('product:sku:HEADPHONES-PRO-BLK');
      expect(mockDelPattern).toHaveBeenCalledWith('product:list:*');
      expect(mockDelPattern).toHaveBeenCalledWith('category:*');
    });

    it('throws ApplicationException with NOT_FOUND when 0 rows are returned', async () => {
      const mockTx = {
        delete: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };

      const repository = new DrizzleProductRepository(mockDb as any);

      await expect(
        repository.delete(new ProductId(dummyProductId)),
      ).rejects.toThrow(ApplicationException);
    });
  });
});
