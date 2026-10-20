import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class StocktakeDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsInt()
  @Min(0)
  countedQuantity!: number;

  @IsString()
  @IsOptional()
  note?: string;
}
