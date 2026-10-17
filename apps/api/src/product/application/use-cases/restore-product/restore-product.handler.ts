import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RestoreProductCommand } from './restore-product.command.js';
import { PRODUCT_REPOSITORY } from '../../ports/product.repository.js';
import type { ProductRepositoryPort } from '../../ports/product.repository.js';
import { ProductId } from '../../../domain/value-objects/product-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RestoreProductCommand)
export class RestoreProductHandler implements ICommandHandler<
  RestoreProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(command: RestoreProductCommand): Promise<void> {
    const productId = new ProductId(command.id);
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new ApplicationException(
        `Product with ID '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    product.restore();
    await this.productRepository.save(product);
  }
}
