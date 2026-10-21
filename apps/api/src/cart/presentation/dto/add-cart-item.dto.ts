import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(20)
  quantity: number = 1;
}
