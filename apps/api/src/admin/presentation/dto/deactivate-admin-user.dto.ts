import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeactivateAdminUserDto {
  @IsString()
  @MinLength(5, {
    message: 'Deactivation reason must be at least 5 characters long',
  })
  @IsNotEmpty({ message: 'Deactivation reason is required' })
  reason!: string;
}
