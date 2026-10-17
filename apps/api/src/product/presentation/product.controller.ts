import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './dto/create-product.dto.js';
import { CreateProductCommand } from '../application/use-cases/create-product/create-product.command.js';
import { DeleteProductCommand } from '../application/use-cases/delete-product/delete-product.command.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import { ListProductQuery } from '../application/queries/list-product/list-product.query.js';
import { GetProductByIdQuery } from '../application/queries/get-product-by-id/get-product-by-id.query.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../shared/application/ports/storage.port.js';

@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; id: string }> {
    this.logger.log(
      `Received create product request: "${dto.title}". Files detected: ${files?.length ?? 0}`,
    );

    let media = dto.media ?? [];

    if (files && files.length > 0) {
      this.logger.log(`Uploading ${files.length} file(s) to Cloudflare R2...`);
      const uploadedFiles = await this.storageService.uploadMany(
        files.map((f) => ({
          buffer: f.buffer,
          originalName: f.originalname,
          mimeType: f.mimetype,
          folder: 'products',
        })),
      );

      const uploadedMedia = uploadedFiles.map((uploaded, index) => {
        const rawName = files[index].originalname.replace(/\.[^/.]+$/, '');
        const cleanAltText = rawName.replace(/[-_]/g, ' ').trim();
        return {
          url: uploaded.url,
          altText: cleanAltText || dto.title,
          isThumbnail: false,
        };
      });

      media = [...media, ...uploadedMedia];
      this.logger.log(
        `Successfully attached ${uploadedMedia.length} image(s) to product.`,
      );
    }

    const id = await this.commandBus.execute<CreateProductCommand, string>(
      new CreateProductCommand(
        dto.title,
        dto.unitPrice,
        dto.sku,
        dto.currency || 'USD',
        dto.description || '',
        dto.basePrice,
        dto.compareAtPrice,
        dto.inventoryQuantity ?? 0,
        dto.trackQuantity ?? true,
        dto.status,
        media,
        dto.tags ?? [],
        dto.category,
        dto.variants ?? [],
      ),
    );

    return {
      success: true,
      message: 'Product created successfully',
      id,
    };
  }

  @Get('all')
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ): Promise<ProductResponseDto[]> {
    return this.queryBus.execute<ListProductQuery, ProductResponseDto[]>(
      new ListProductQuery(
        isActive !== undefined ? isActive === 'true' : undefined,
        minPrice !== undefined ? parseFloat(minPrice) : undefined,
        maxPrice !== undefined ? parseFloat(maxPrice) : undefined,
        status,
        category,
      ),
    );
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.queryBus.execute<GetProductByIdQuery, ProductResponseDto>(
      new GetProductByIdQuery(id),
    );
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string; id: string }> {
    await this.commandBus.execute<DeleteProductCommand, void>(
      new DeleteProductCommand(id),
    );

    return {
      success: true,
      message: 'Product deleted successfully',
      id,
    };
  }
}
