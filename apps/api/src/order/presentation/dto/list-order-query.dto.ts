import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto.js';

export class ListOrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ])
  status?: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;
}
