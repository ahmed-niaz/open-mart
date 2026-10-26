import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;
}
