import { IsNotEmpty, IsString } from 'class-validator';

export class ReturnOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Return reason is required' })
  reason!: string;
}
