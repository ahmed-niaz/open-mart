import { IsNotEmpty, IsString } from 'class-validator';

export class QueryAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  skus!: string; // comma-separated list of SKUs e.g. "SKU1,SKU2"
}
