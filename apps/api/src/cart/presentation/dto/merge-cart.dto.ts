import { IsNotEmpty, IsString } from 'class-validator';

export class MergeCartDto {
  @IsNotEmpty()
  @IsString()
  guestId: string;
}
