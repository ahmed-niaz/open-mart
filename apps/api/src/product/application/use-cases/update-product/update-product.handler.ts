import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { UpdateProductCommand } from './update-product.command.js';
import { PRODUCT_REPOSITORY } from '../../ports/product.repository.js';
import type { ProductRepositoryPort } from '../../ports/product.repository.js';
import { ProductVariant } from '../../../domain/entities/product.entity.js';
import { ProductId } from '../../../domain/value-objects/product-id.vo.js';
import { SKU } from '../../../domain/value-objects/sku.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler implements ICommandHandler<
  UpdateProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(command: UpdateProductCommand): Promise<void> {
    const productId = new ProductId(command.id);
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new ApplicationException(
        `Product with ID '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // 1. Business Invariant: If title is being updated, verify uniqueness
    if (command.title && command.title.trim() !== product.title) {
      const existingProduct = await this.productRepository.findByTitle(
        command.title.trim(),
      );
      if (
        existingProduct &&
        existingProduct.id.getValue() !== product.id.getValue()
      ) {
        throw new ApplicationException(
          `Product with title '${command.title}' already exists.`,
          ApplicationExceptionCode.CONFLICT,
        );
      }
    }

    // 2. Resolve currency (use existing currency if not explicitly provided)
    const currency = command.currency || product.unitPrice.getCurrency();

    // 3. Construct Money Value Objects
    const unitPrice =
      command.unitPrice !== undefined
        ? Money.create(command.unitPrice, currency)
        : undefined;

    const basePrice =
      command.basePrice !== undefined
        ? Money.create(command.basePrice, currency)
        : undefined;

    const compareAtPrice =
      command.compareAtPrice !== undefined
        ? Money.create(command.compareAtPrice, currency)
        : undefined;

    // 4. Map Variants if provided
    const variants: ProductVariant[] | undefined =
      command.variants !== undefined
        ? command.variants.map((v) => ({
            id: v.id ?? randomUUID(),
            name: v.name,
            type: v.type,
            color: v.color,
            options: v.options,
            sku: v.sku ? SKU.create(v.sku) : undefined,
            unitPrice:
              v.unitPrice !== undefined
                ? Money.create(v.unitPrice, currency)
                : undefined,
            inventoryQuantity: v.inventoryQuantity ?? 0,
          }))
        : undefined;

    // 5. Mutate Aggregate Root (Enforces Domain Invariants)
    product.update({
      title: command.title,
      description: command.description,
      category: command.category,
      unitPrice,
      basePrice,
      compareAtPrice,
      inventoryQuantity: command.inventoryQuantity,
      trackQuantity: command.trackQuantity,
      tags: command.tags,
      status: command.status,
      variants,
      media: command.media,
    });

    // 6. Persist Aggregate (Atomic OCC Update)
    await this.productRepository.save(product);
  }
}
