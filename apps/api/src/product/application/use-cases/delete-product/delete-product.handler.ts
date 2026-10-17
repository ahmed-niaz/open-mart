import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DeleteProductCommand } from './delete-product.command.js';
import {
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from '../../ports/product.repository.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../../shared/application/ports/storage.port.js';
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
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
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

    // 2. Clean up media from Cloudflare R2 if present (Rule 6: cleanup on permanent deletion)
    if (product.media && product.media.length > 0) {
      for (const item of product.media) {
        try {
          // Extract R2 key from URL: e.g. https://.../products/2026/10/uuid-name.jpg -> products/2026/10/uuid-name.jpg
          const urlObj = new URL(item.url);
          const key = urlObj.pathname.replace(/^\/+/, '');
          if (key) {
            await this.storageService.delete(key);
            this.logger.log(`Deleted media asset from R2: ${key}`);
          }
        } catch {
          this.logger.warn(
            `Could not parse/delete storage key for media url: ${item.url}`,
          );
        }
      }
    }

    // 3. Permanently remove from database
    await this.productRepository.delete(productId);
    this.logger.log(
      `Product '${command.id}' permanently deleted from database.`,
    );
  }
}
