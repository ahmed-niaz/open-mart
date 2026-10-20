import { IsNotEmpty, IsString } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  reason!: string;
}
