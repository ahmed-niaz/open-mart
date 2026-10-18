import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { ListCategoryQueryDto } from './dto/list-category-query.dto.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { CategoryTreeNodeDto } from './dto/category-tree-node.dto.js';
import { CreateCategoryCommand } from '../application/use-cases/create-category/create-category.command.js';
import { UpdateCategoryCommand } from '../application/use-cases/update-category/update-category.command.js';
import { ActivateCategoryCommand } from '../application/use-cases/activate-category/activate-category.command.js';
import { DeactivateCategoryCommand } from '../application/use-cases/deactivate-category/deactivate-category.command.js';
import { GetCategoryTreeQuery } from '../application/queries/get-category-tree/get-category-tree.query.js';
import { GetCategoryByIdQuery } from '../application/queries/get-category-by-id/get-category-by-id.query.js';
import { GetCategoryBySlugQuery } from '../application/queries/get-category-by-slug/get-category-by-slug.query.js';
import { ListCategoriesQuery } from '../application/queries/list-categories/list-categories.query.js';
import { PaginatedResult } from '../../shared/application/pagination/paginated-result.js';

@Controller('categories')
export class CategoryController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCategoryDto): Promise<{ id: string }> {
    const command = new CreateCategoryCommand(
      dto.name,
      dto.description,
      dto.parentId,
      dto.imageUrl,
      dto.displayOrder,
      dto.isActive,
    );
    return await this.commandBus.execute(command);
  }

  @Get('tree')
  async getTree(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<CategoryTreeNodeDto[]> {
    const query = new GetCategoryTreeQuery(includeInactive === 'true');
    return await this.queryBus.execute(query);
  }

  @Get()
  async list(
    @Query() queryDto: ListCategoryQueryDto,
  ): Promise<PaginatedResult<CategoryResponseDto>> {
    const parentId =
      queryDto.parentId === 'null' || queryDto.parentId === 'root'
        ? null
        : queryDto.parentId;

    const query = new ListCategoriesQuery(
      queryDto.page,
      queryDto.limit,
      queryDto.search,
      queryDto.isActive,
      parentId,
    );
    return await this.queryBus.execute(query);
  }

  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    const query = new GetCategoryBySlugQuery(slug);
    return await this.queryBus.execute(query);
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    const query = new GetCategoryByIdQuery(id);
    return await this.queryBus.execute(query);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<{ success: boolean }> {
    const command = new UpdateCategoryCommand(
      id,
      dto.name,
      dto.description,
      dto.parentId,
      dto.imageUrl,
      dto.displayOrder,
    );
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Patch(':id/activate')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const command = new ActivateCategoryCommand(id);
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const command = new DeactivateCategoryCommand(id);
    await this.commandBus.execute(command);
    return { success: true };
  }
}
