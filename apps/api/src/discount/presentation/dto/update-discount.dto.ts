import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class UpdateDiscountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, {
    message:
      'Code must be 3-30 characters containing only letters, numbers, hyphens, and underscores',
  })
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['percentage', 'fixed_amount', 'free_shipping'])
  @IsOptional()
  type?: 'percentage' | 'fixed_amount' | 'free_shipping';

  @IsInt({ message: 'Value must be an integer' })
  @Min(1, { message: 'Value must be at least 1' })
  @IsOptional()
  value?: number;

  @IsDateString(
    {},
    { message: 'startsAt must be a valid ISO 8601 date string' },
  )
  @IsOptional()
  startsAt?: string;

  @IsDateString(
    {},
    { message: 'expiresAt must be a valid ISO 8601 date string' },
  )
  @IsOptional()
  expiresAt?: string;

  @IsInt({ message: 'minOrderAmount must be an integer (in poisha)' })
  @Min(0, { message: 'minOrderAmount cannot be negative' })
  @IsOptional()
  minOrderAmount?: number;

  @IsInt({ message: 'maxDiscountAmount must be an integer (in poisha)' })
  @Min(1, { message: 'maxDiscountAmount must be positive' })
  @IsOptional()
  maxDiscountAmount?: number;

  @IsInt({ message: 'maxUsageLimit must be an integer' })
  @Min(1, { message: 'maxUsageLimit must be at least 1' })
  @IsOptional()
  maxUsageLimit?: number;

  @IsInt({ message: 'maxUsagePerCustomer must be an integer' })
  @Min(1, { message: 'maxUsagePerCustomer must be at least 1' })
  @IsOptional()
  maxUsagePerCustomer?: number;

  @IsIn(['all', 'registered_only'])
  @IsOptional()
  customerEligibility?: 'all' | 'registered_only';

  @IsIn(['all_products', 'specific_products', 'specific_categories'])
  @IsOptional()
  scope?: 'all_products' | 'specific_products' | 'specific_categories';

  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'Each target product ID must be a valid UUID',
  })
  @IsOptional()
  targetProductIds?: string[];

  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'Each target category ID must be a valid UUID',
  })
  @IsOptional()
  targetCategoryIds?: string[];

  @IsBoolean()
  @IsOptional()
  excludeSaleItems?: boolean;
}
