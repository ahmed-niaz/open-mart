import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DeleteProductCommand } from './delete-product.command.js';
import {
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from '../../ports/product.repository.js';
import { ProductId } from '../../../domain/value-objects/product-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<
  DeleteProductCommand,
  void
> {
  private readonly logger = new Logger(DeleteProductHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const productId = new ProductId(command.id);

    // 1. Verify existence
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ApplicationException(
        `Product with id '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // 2. Permanently remove from database (transactional cascade)
    // Note: Per architecture rules and user requirement, deleting a product
    // NEVER deletes media assets from Cloudflare R2 or the database.
    // Media assets remain preserved in the Media Library for reuse or manual deletion.
    await this.productRepository.delete(productId);
    this.logger.log(
      `Product '${command.id}' permanently deleted from database. Media assets preserved in Media Library.`,
    );
  }
}
