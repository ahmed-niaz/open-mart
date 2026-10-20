import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID('4', { message: 'Order ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId!: string;

  @IsIn(['stripe', 'cod', 'sslcommerz'], {
    message: 'Provider must be one of: stripe, cod, sslcommerz',
  })
  @IsNotEmpty({ message: 'Payment provider is required' })
  provider!: 'stripe' | 'cod' | 'sslcommerz';

  @IsEmail({}, { message: 'A valid email address is required' })
  @IsOptional()
  customerEmail?: string;
}

