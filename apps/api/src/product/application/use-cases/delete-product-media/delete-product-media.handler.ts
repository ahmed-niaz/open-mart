import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DeleteProductMediaCommand } from './delete-product-media.command.js';
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

@CommandHandler(DeleteProductMediaCommand)
export class DeleteProductMediaHandler implements ICommandHandler<
  DeleteProductMediaCommand,
  void
> {
  private readonly logger = new Logger(DeleteProductMediaHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
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

    // 2. Remove media asset from Domain Aggregate (enforces invariant)
    product.removeMedia(command.mediaUrl);

    // 3. Persist state change (Atomic OCC Update)
    await this.productRepository.save(product);

    // 4. Purge media asset from Cloudflare R2
    try {
      const urlObj = new URL(command.mediaUrl);
      const key = urlObj.pathname.replace(/^\/+/, '');
      if (key) {
        await this.storageService.delete(key);
        this.logger.log(`Purged media asset from Cloudflare R2: ${key}`);
      }
    } catch {
      this.logger.warn(
        `Could not parse or delete R2 storage key for URL: ${command.mediaUrl}`,
      );
    }
  }
}
