import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { AdminJwtGuard } from '../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../shared/infrastructure/guards/admin-permissions.js';
import { CurrentAdmin } from '../../shared/presentation/decorators/current-admin.decorator.js';
import type { AuthenticatedUser } from '../../shared/presentation/interfaces/authenticated-user.interface.js';

import { UploadMediaCommand } from '../application/commands/upload-media/upload-media.command.js';
import { UpdateMediaMetadataCommand } from '../application/commands/update-media-metadata/update-media-metadata.command.js';
import { DeleteMediaAssetCommand } from '../application/commands/delete-media-asset/delete-media-asset.command.js';
import { BulkDeleteMediaCommand } from '../application/commands/bulk-delete-media/bulk-delete-media.command.js';

import { ListMediaQuery } from '../application/queries/list-media/list-media.query.js';
import { GetMediaSummaryQuery } from '../application/queries/get-media-summary/get-media-summary.query.js';
import { GetMediaByIdQuery } from '../application/queries/get-media-by-id/get-media-by-id.query.js';

import { ListMediaQueryDto } from './dto/list-media-query.dto.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { BulkDeleteMediaDto } from './dto/bulk-delete-media.dto.js';

@Controller('admin/media')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class MediaAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/admin/media/upload
   * Multipart upload (single or multiple files). Saves to R2, persists in media_assets.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(AdminPermission.PRODUCTS_WRITE)
  @UseInterceptors(AnyFilesInterceptor())
  async upload(
    @UploadedFiles() files?: Express.Multer.File[],
    @Body('folder') folder?: string,
    @CurrentAdmin() admin?: AuthenticatedUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least one file is required for upload.',
      );
    }

    return this.commandBus.execute(
      new UploadMediaCommand(
        files.map((f) => ({
          buffer: f.buffer,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
        })),
        folder || 'media-library',
        admin?.id,
      ),
    );
  }

  /**
   * GET /api/admin/media
   * Paginated list of media assets with search, MIME-type filtering, and sorting.
   */
  @Get()
  @RequirePermissions(AdminPermission.PRODUCTS_READ)
  async list(@Query() query: ListMediaQueryDto) {
    return this.queryBus.execute(
      new ListMediaQuery(
        query.page,
        query.limit,
        query.search,
        query.mimeType,
        query.isArchived,
        query.sortBy,
        query.sortOrder,
      ),
    );
  }

  /**
   * GET /api/admin/media/summary
   * KPI metrics for the Media Library.
   */
  @Get('summary')
  @RequirePermissions(AdminPermission.PRODUCTS_READ)
  async getSummary() {
    return this.queryBus.execute(new GetMediaSummaryQuery());
  }

  /**
   * GET /api/admin/media/:id
   * Single media asset details, metadata, and product association list.
   */
  @Get(':id')
  @RequirePermissions(AdminPermission.PRODUCTS_READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetMediaByIdQuery(id));
  }

  /**
   * PATCH /api/admin/media/:id
   * Update media metadata (altText, originalName).
   */
  @Patch(':id')
  @RequirePermissions(AdminPermission.PRODUCTS_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.commandBus.execute(
      new UpdateMediaMetadataCommand(id, dto.altText, dto.originalName),
    );
  }

  /**
   * DELETE /api/admin/media/:id
   * Permanent Deletion: Purges file from Cloudflare R2 and deletes database row.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(AdminPermission.PRODUCTS_DELETE)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    await this.commandBus.execute(
      new DeleteMediaAssetCommand(id, force === 'true'),
    );
  }

  /**
   * POST /api/admin/media/bulk-delete
   * Batch permanent delete for selected assets.
   */
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AdminPermission.PRODUCTS_DELETE)
  async bulkDelete(@Body() dto: BulkDeleteMediaDto) {
    return this.commandBus.execute(
      new BulkDeleteMediaCommand(dto.ids, dto.force),
    );
  }
}
