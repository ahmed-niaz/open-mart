import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { CreateProductCommand } from './create-product.command.js';
import { PRODUCT_REPOSITORY } from '../../ports/product.repository.js';
import type { ProductRepositoryPort } from '../../ports/product.repository.js';
import {
  Product,
  ProductVariant,
} from '../../../domain/entities/product.entity.js';
import { SKU } from '../../../domain/value-objects/sku.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<
  CreateProductCommand,
  string
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(command: CreateProductCommand): Promise<string> {
    // 1. Business Invariant: SKU Uniqueness Check
    const skuVo = SKU.create(command.sku);
    const existingProductBySku = await this.productRepository.findBySku(skuVo);
    if (existingProductBySku) {
      throw new ApplicationException(
        `Product with SKU '${command.sku}' already exists.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    // 2. Business Invariant: Title Uniqueness Check
    const existingProductByTitle = await this.productRepository.findByTitle(
      command.title,
    );
    if (existingProductByTitle) {
      throw new ApplicationException(
        `Product with title '${command.title}' already exists.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    // 3. Construct Money Value Objects
    const unitPrice = Money.create(command.unitPrice, command.currency);
    const basePrice =
      command.basePrice !== undefined
        ? Money.create(command.basePrice, command.currency)
        : undefined;
    const compareAtPrice =
      command.compareAtPrice !== undefined
        ? Money.create(command.compareAtPrice, command.currency)
        : undefined;

    // 4. Map Variants to Domain Models
    const variants: ProductVariant[] = (command.variants ?? []).map((v) => ({
      id: v.id ?? randomUUID(),
      name: v.name,
      type: v.type,
      color: v.color,
      options: v.options,
      sku: v.sku ? SKU.create(v.sku) : undefined,
      unitPrice:
        v.unitPrice !== undefined
          ? Money.create(v.unitPrice, command.currency)
          : undefined,
      inventoryQuantity: v.inventoryQuantity ?? 0,
    }));

    // 5. Instantiate Aggregate Root (Enforces Domain Invariants)
    const product = Product.create({
      title: command.title,
      description: command.description,
      media: command.media,
      tags: command.tags,
      status: command.status,
      category: command.category,
      unitPrice,
      basePrice,
      compareAtPrice,
      sku: skuVo,
      inventoryQuantity: command.inventoryQuantity,
      trackQuantity: command.trackQuantity,
      variants,
    });

    // 6. Persist Aggregate (Atomic OCC)
    await this.productRepository.save(product);

    return product.id.getValue();
  }
}
