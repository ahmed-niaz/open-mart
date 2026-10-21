import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangeDiscountStatusDto {
  @IsIn(['active', 'paused', 'archived'], {
    message: 'Status must be active, paused, or archived',
  })
  @IsNotEmpty({ message: 'Target status is required' })
  status!: 'active' | 'paused' | 'archived';

  @IsString()
  @IsOptional()
  reason?: string;
}
