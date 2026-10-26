import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DeleteProductMediaCommand } from './delete-product-media.command.js';
import {
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from '../../ports/product.repository.js';
import { ProductId } from '../../../domain/value-objects/product-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeleteProductMediaCommand)
export class DeleteProductMediaHandler implements ICommandHandler<
  DeleteProductMediaCommand,
  void
> {
  private readonly logger = new Logger(DeleteProductMediaHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(command: DeleteProductMediaCommand): Promise<void> {
    const productId = new ProductId(command.productId);

    // 1. Verify existence
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ApplicationException(
        `Product with ID '${command.productId}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // 2. Remove media asset reference from Domain Aggregate (enforces invariant)
    product.removeMedia(command.mediaUrl);

    // 3. Persist state change (Atomic OCC Update)
    await this.productRepository.save(product);

    // 4. Note: Per architecture rules, detaching an image from a product NEVER deletes
    // the underlying file from Cloudflare R2 or the database. Physical deletion is strictly
    // restricted to the centralized Media Library module.
    this.logger.log(
      `Detached media '${command.mediaUrl}' from product '${command.productId}'. Underlying asset preserved in Media Library.`,
    );
  }
}
