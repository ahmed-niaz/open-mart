import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductDto } from './dto/create-product.dto.js';
import { CreateProductCommand } from '../application/use-cases/create-product/create-product.command.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import { ListProductQuery } from '../application/queries/list-product/list-product.query.js';
import { GetProductByIdQuery } from '../application/queries/get-product-by-id/get-product-by-id.query.js';

@Controller('products')
export class ProductController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateProductDto,
  ): Promise<{ success: boolean; message: string; id: string }> {
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
        dto.media ?? [],
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
}
