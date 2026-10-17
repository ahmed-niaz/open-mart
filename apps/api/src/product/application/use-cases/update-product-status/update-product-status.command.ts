import { ICommand } from '@nestjs/cqrs';
import { ProductStatus } from '../../../domain/entities/product.entity.js';

export class UpdateProductStatusCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly status: ProductStatus,
  ) {}
}
