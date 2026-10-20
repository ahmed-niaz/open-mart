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
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty()
  productId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;
}

export class GuestCustomerDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class ShippingAddressDto {
  @IsString()
  @Length(2, 100, {
    message: 'Recipient name must be between 2 and 100 characters',
  })
  @IsNotEmpty({ message: 'Recipient name is required' })
  recipientName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Recipient phone is required' })
  recipientPhone!: string;

  @IsString()
  @IsOptional()
  altPhone?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Division is required' })
  division!: string;

  @IsString()
  @IsNotEmpty({ message: 'District is required' })
  district!: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'Area is required' })
  area!: string;

  @IsString()
  @IsNotEmpty({ message: 'Address line is required' })
  addressLine!: string;

  @IsString()
  @IsOptional()
  postalCode?: string | null;

  @IsString()
  @IsOptional()
  country?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @ValidateNested()
  @Type(() => GuestCustomerDto)
  @IsOptional()
  customer?: GuestCustomerDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
