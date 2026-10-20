import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;

  @IsBoolean()
  isActive!: boolean;
}
