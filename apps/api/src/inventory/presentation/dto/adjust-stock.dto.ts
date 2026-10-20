import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  NotEquals,
} from 'class-validator';

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsInt()
  @NotEquals(0)
  delta!: number; // can be negative (damaged/lost)

  @IsString()
  @IsIn(['damaged', 'loss'])
  reason!: 'damaged' | 'loss';

  @IsString()
  @IsOptional()
  note?: string;
}
