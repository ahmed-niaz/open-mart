import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ShipOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Tracking number is required' })
  trackingNumber!: string;

  @IsString()
  @IsOptional()
  courierName?: string;
}
