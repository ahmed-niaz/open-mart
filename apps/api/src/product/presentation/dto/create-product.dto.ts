import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../domain/entities/product.entity.js';

export class ProductMediaDto {
  @IsUrl()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isThumbnail?: boolean;
}

export class ProductCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'Variant SKU must contain only alphanumeric characters and dashes',
  })
  sku?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : 0,
  )
  @IsNumber()
  @Min(0)
  inventoryQuantity?: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return value
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus = ProductStatus.DRAFT;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch {
        return { name: value };
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => ProductCategoryDto)
  category?: ProductCategoryDto;

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : value,
  )
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string = 'USD';

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'SKU must contain only alphanumeric characters and dashes',
  })
  sku: string;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : 0,
  )
  @IsNumber()
  @Min(0)
  inventoryQuantity?: number = 0;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : Boolean(value),
  )
  @IsBoolean()
  trackQuantity?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
