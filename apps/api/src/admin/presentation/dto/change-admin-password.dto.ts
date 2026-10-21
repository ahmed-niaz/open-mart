import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ChangeAdminPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsNotEmpty({ message: 'New password is required' })
  newPassword!: string;
}
