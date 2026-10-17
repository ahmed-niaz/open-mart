import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class DeleteProductMediaDto {
  @IsNotEmpty({ message: 'Media URL is required' })
  @IsString()
  @IsUrl({}, { message: 'Must be a valid media URL' })
  url: string;
}
