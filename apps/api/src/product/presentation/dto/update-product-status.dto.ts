import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProductStatus } from '../../domain/entities/product.entity.js';

export class UpdateProductStatusDto {
  @IsNotEmpty({ message: 'Product status is required.' })
  @IsEnum(ProductStatus, {
    message: `Status must be one of: ${Object.values(ProductStatus).join(', ')}`,
  })
  status: ProductStatus;
}
