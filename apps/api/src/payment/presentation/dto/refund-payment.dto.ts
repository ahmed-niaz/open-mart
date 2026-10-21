import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  amountCents?: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsBoolean()
  isOfflinePayout?: boolean;

  @IsOptional()
  @IsString()
  offlineReference?: string;
}
