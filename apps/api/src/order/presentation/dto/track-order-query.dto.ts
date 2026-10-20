import { IsNotEmpty, IsString } from 'class-validator';

export class TrackOrderQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Order number is required' })
  orderNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;
}
