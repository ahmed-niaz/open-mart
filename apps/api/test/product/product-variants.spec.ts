import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateProductCommand } from '../../src/product/application/use-cases/create-product/create-product.command.js';
import { CreateProductHandler } from '../../src/product/application/use-cases/create-product/create-product.handler.js';
import { UpdateProductCommand } from '../../src/product/application/use-cases/update-product/update-product.command.js';
import { UpdateProductHandler } from '../../src/product/application/use-cases/update-product/update-product.handler.js';
import type { ProductRepositoryPort } from '../../src/product/application/ports/product.repository.js';
import type { CategoryVerificationPort } from '../../src/product/application/ports/category-verification.port.js';
import {
  Product,
  ProductStatus,
} from '../../src/product/domain/entities/product.entity.js';
import { ProductId } from '../../src/product/domain/value-objects/product-id.vo.js';
import { Money } from '../../src/shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../src/shared/domain/exceptions/application.exception.js';
import { ProductResponseDto } from '../../src/product/application/dto/product-response.dto.js';
import type { ProductSelectRow } from '../../src/shared/infrastructure/database/postgres/schema/product.schema.js';

describe('Product Variants Unit Tests', () => {
  let mockProductRepo: ProductRepositoryPort;
  let mockCategoryVerification: CategoryVerificationPort;

  beforeEach(() => {
    mockProductRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findBySku: vi.fn().mockResolvedValue(null),
      findByTitle: vi.fn().mockResolvedValue(null),
      findAll: vi.fn(),
      delete: vi.fn(),
    } as unknown as ProductRepositoryPort;

    mockCategoryVerification = {
      isCategoryValid: vi.fn().mockResolvedValue(true),
    };
  });

  describe('CreateProductHandler with Variants', () => {
    it('successfully creates product with variants and persists them', async () => {
      const handler = new CreateProductHandler(
        mockProductRepo,
        mockCategoryVerification,
      );

      const command = new CreateProductCommand(
        'Premium Cotton T-Shirt',
        1200,
        'TSHIRT-BASE',
        'BDT',
        'Comfortable cotton t-shirt',
        undefined,
        undefined,
        50,
        true,
        ProductStatus.ACTIVE,
        [],
        ['apparel', 'cotton'],
        undefined,
        undefined,
        [
          {
            name: 'Small / Black',
            type: 'Size',
            color: 'Black',
            options: { Size: 'S', Color: 'Black' },
            sku: 'TSHIRT-S-BLK',
            unitPrice: 1200,
            inventoryQuantity: 20,
          },
          {
            name: 'Medium / White',
            type: 'Size',
            color: 'White',
            options: { Size: 'M', Color: 'White' },
            sku: 'TSHIRT-M-WHT',
            unitPrice: 1300,
            inventoryQuantity: 30,
          },
        ],
      );

      const id = await handler.execute(command);
      expect(id).toBeDefined();

      expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
      const savedProduct = (mockProductRepo.save as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Product;
      expect(savedProduct.variants).toHaveLength(2);
      expect(savedProduct.variants[0].sku?.getValue()).toBe('TSHIRT-S-BLK');
      expect(savedProduct.variants[0].options).toEqual({
        Size: 'S',
        Color: 'Black',
      });
      expect(savedProduct.variants[0].unitPrice?.toCents()).toBe(120000);
      expect(savedProduct.variants[0].inventoryQuantity).toBe(20);
      expect(savedProduct.variants[1].sku?.getValue()).toBe('TSHIRT-M-WHT');
      expect(savedProduct.variants[1].unitPrice?.toCents()).toBe(130000);
    });

    it('rejects duplicate variant SKUs within the same product', async () => {
      const handler = new CreateProductHandler(
        mockProductRepo,
        mockCategoryVerification,
      );

      const command = new CreateProductCommand(
        'Duplicate SKU T-Shirt',
        1000,
        'TSHIRT-DUP',
        'BDT',
        '',
        undefined,
        undefined,
        10,
        true,
        ProductStatus.DRAFT,
        [],
        [],
        undefined,
        undefined,
        [
          { sku: 'DUP-SKU-1', name: 'Variant 1' },
          { sku: 'DUP-SKU-1', name: 'Variant 2' },
        ],
      );

      await expect(handler.execute(command)).rejects.toThrow(
        new ApplicationException(
          "Duplicate variant SKU 'DUP-SKU-1' detected within product.",
          ApplicationExceptionCode.CONFLICT,
        ),
      );
    });

    it('rejects variant SKU identical to the parent product SKU', async () => {
      const handler = new CreateProductHandler(
        mockProductRepo,
        mockCategoryVerification,
      );

      const command = new CreateProductCommand(
        'Collision SKU T-Shirt',
        1000,
        'PARENT-SKU',
        'BDT',
        '',
        undefined,
        undefined,
        10,
        true,
        ProductStatus.DRAFT,
        [],
        [],
        undefined,
        undefined,
        [{ sku: 'PARENT-SKU', name: 'Variant Collision' }],
      );

      await expect(handler.execute(command)).rejects.toThrow(
        new ApplicationException(
          "Variant SKU 'PARENT-SKU' cannot be identical to the parent product SKU.",
          ApplicationExceptionCode.CONFLICT,
        ),
      );
    });
  });

  describe('UpdateProductHandler with Variants', () => {
    it('successfully updates variants on existing product', async () => {
      const existingProduct = Product.create({
        id: new ProductId('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
        title: 'Original T-Shirt',
        sku: 'ORIG-SKU',
        unitPrice: Money.create(500, 'BDT'),
        inventoryQuantity: 10,
        trackQuantity: true,
      });

      (mockProductRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingProduct,
      );
      const handler = new UpdateProductHandler(
        mockProductRepo,
        mockCategoryVerification,
      );

      const updateCommand = new UpdateProductCommand(
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'Updated T-Shirt',
        undefined,
        'BDT',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [
          {
            name: 'Large / Red',
            sku: 'ORIG-L-RED',
            unitPrice: 650,
            inventoryQuantity: 15,
            options: { Size: 'L', Color: 'Red' },
          },
        ],
      );

      await handler.execute(updateCommand);
      expect(mockProductRepo.save).toHaveBeenCalledTimes(1);
      expect(existingProduct.variants).toHaveLength(1);
      expect(existingProduct.variants[0].sku?.getValue()).toBe('ORIG-L-RED');
      expect(existingProduct.variants[0].unitPrice?.toCents()).toBe(65000);
      expect(existingProduct.variants[0].inventoryQuantity).toBe(15);
    });

    it('rejects variant SKU identical to parent product SKU during update', async () => {
      const existingProduct = Product.create({
        id: new ProductId('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
        title: 'Original T-Shirt',
        sku: 'PARENT-EXISTING',
        unitPrice: Money.create(500, 'BDT'),
        inventoryQuantity: 10,
        trackQuantity: true,
      });

      (mockProductRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingProduct,
      );
      const handler = new UpdateProductHandler(
        mockProductRepo,
        mockCategoryVerification,
      );

      const updateCommand = new UpdateProductCommand(
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        undefined,
        undefined,
        'BDT',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ sku: 'PARENT-EXISTING', name: 'Collision' }],
      );

      await expect(handler.execute(updateCommand)).rejects.toThrow(
        new ApplicationException(
          "Variant SKU 'PARENT-EXISTING' cannot be identical to the parent product SKU.",
          ApplicationExceptionCode.CONFLICT,
        ),
      );
    });
  });

  describe('ProductResponseDto Projection with Variants', () => {
    it('correctly maps raw persistence row with variants', () => {
      const mockRow = {
        id: 'p-123',
        title: 'Sneakers',
        description: 'Running shoes',
        media: [{ url: 'https://cdn.example.com/shoe.jpg', isThumbnail: true }],
        tags: ['shoes'],
        status: 'active',
        categoryId: null,
        category: null,
        unitPriceAmount: 450000,
        unitPriceCurrency: 'BDT',
        basePriceAmount: null,
        basePriceCurrency: null,
        compareAtPriceAmount: null,
        compareAtPriceCurrency: null,
        sku: 'SHOE-001',
        inventoryQuantity: 100,
        trackQuantity: true,
        variants: [
          {
            id: 'v-1',
            name: 'Size 42 / Black',
            sku: 'SHOE-001-42-BLK',
            options: { Size: '42', Color: 'Black' },
            priceAmount: 450000,
            priceCurrency: 'BDT',
            inventoryQuantity: 40,
          },
          {
            id: 'v-2',
            name: 'Size 43 / Blue',
            sku: 'SHOE-001-43-BLU',
            options: { Size: '43', Color: 'Blue' },
            priceAmount: 470000,
            priceCurrency: 'BDT',
            inventoryQuantity: 60,
          },
        ],
        version: 1,
        createdAt: new Date('2026-10-20T10:00:00Z'),
        updatedAt: new Date('2026-10-20T10:00:00Z'),
      } as unknown as ProductSelectRow;

      const dto = ProductResponseDto.fromPersistence(mockRow);
      expect(dto.id).toBe('p-123');
      expect(dto.variants).toHaveLength(2);
      expect(dto.variants[0].sku).toBe('SHOE-001-42-BLK');
      expect(dto.variants[0].unitPrice).toBe(450000); // minor currency units (cents/poisha)
      expect(dto.variants[0].inventoryQuantity).toBe(40);
      expect(dto.variants[1].sku).toBe('SHOE-001-43-BLU');
      expect(dto.variants[1].unitPrice).toBe(470000);
      expect(dto.variants[1].inventoryQuantity).toBe(60);
    });
  });
});
