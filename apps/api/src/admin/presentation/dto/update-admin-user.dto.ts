import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAdminUserDto {
  @IsString()
  @IsNotEmpty({ message: 'First name cannot be empty' })
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name cannot be empty' })
  lastName!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
