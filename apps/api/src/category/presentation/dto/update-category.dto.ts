import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsUUID('4', { message: 'parentId must be a valid UUID or null' })
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== '')
  @IsUrl()
  imageUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
