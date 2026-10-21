import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemValidationDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty()
  productId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;
}

export class ValidateDiscountDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required in cart' })
  @ValidateNested({ each: true })
  @Type(() => CartItemValidationDto)
  items!: CartItemValidationDto[];

  @IsInt({ message: 'shippingFee must be an integer (in poisha)' })
  @Min(0, { message: 'shippingFee cannot be negative' })
  @IsOptional()
  shippingFee?: number;

  @IsEmail({}, { message: 'guestEmail must be a valid email' })
  @IsOptional()
  guestEmail?: string;
}
