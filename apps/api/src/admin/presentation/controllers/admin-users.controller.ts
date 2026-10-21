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
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CreateAdminUserCommand } from '../../application/commands/create-admin-user/create-admin-user.command.js';
import { UpdateAdminUserCommand } from '../../application/commands/update-admin-user/update-admin-user.command.js';
import { ChangeAdminRoleCommand } from '../../application/commands/change-admin-role/change-admin-role.command.js';
import { DeactivateAdminUserCommand } from '../../application/commands/deactivate-admin-user/deactivate-admin-user.command.js';
import { ActivateAdminUserCommand } from '../../application/commands/activate-admin-user/activate-admin-user.command.js';
import { GetAdminUserByIdQuery } from '../../application/queries/get-admin-user-by-id/get-admin-user-by-id.query.js';
import { ListAdminUsersQuery } from '../../application/queries/list-admin-users/list-admin-users.query.js';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto.js';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto.js';
import { ChangeAdminRoleDto } from '../dto/change-admin-role.dto.js';
import { DeactivateAdminUserDto } from '../dto/deactivate-admin-user.dto.js';
import { ListAdminUsersQueryDto } from '../dto/list-admin-users-query.dto.js';
import { AdminJwtGuard } from '../../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../../shared/infrastructure/guards/permissions.guard.js';
import { CurrentAdmin } from '../../../shared/presentation/decorators/current-admin.decorator.js';
import { RequirePermissions } from '../../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../../shared/infrastructure/guards/admin-permissions.js';
import type { AuthenticatedUser } from '../../../shared/presentation/interfaces/authenticated-user.interface.js';

@Controller('admin/users')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @RequirePermissions(AdminPermission.STAFF_READ)
  async listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.queryBus.execute(
      new ListAdminUsersQuery(
        query.page,
        query.limit,
        query.search,
        query.role,
        query.isActive,
      ),
    );
  }

  @Get(':id')
  @RequirePermissions(AdminPermission.STAFF_READ)
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetAdminUserByIdQuery(id));
  }

  @Post()
  @RequirePermissions(AdminPermission.STAFF_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @CurrentAdmin() operator: AuthenticatedUser,
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.commandBus.execute(
      new CreateAdminUserCommand(
        operator.id,
        dto.email,
        dto.password,
        dto.firstName,
        dto.lastName,
        dto.role,
        dto.phoneNumber,
        dto.avatarUrl,
        true,
      ),
    );
  }

  @Patch(':id')
  @RequirePermissions(AdminPermission.STAFF_UPDATE)
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() operator: AuthenticatedUser,
    @Body() dto: UpdateAdminUserDto,
  ) {
    await this.commandBus.execute(
      new UpdateAdminUserCommand(
        operator.id,
        id,
        dto.firstName,
        dto.lastName,
        dto.phoneNumber,
        dto.avatarUrl,
      ),
    );
    return { message: 'Administrator profile updated successfully' };
  }

  @Patch(':id/role')
  @RequirePermissions(AdminPermission.STAFF_MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() operator: AuthenticatedUser,
    @Body() dto: ChangeAdminRoleDto,
  ) {
    await this.commandBus.execute(
      new ChangeAdminRoleCommand(operator.id, id, dto.role),
    );
    return { message: 'Administrator role updated successfully' };
  }

  @Patch(':id/deactivate')
  @RequirePermissions(AdminPermission.STAFF_DEACTIVATE)
  @HttpCode(HttpStatus.OK)
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() operator: AuthenticatedUser,
    @Body() dto: DeactivateAdminUserDto,
  ) {
    await this.commandBus.execute(
      new DeactivateAdminUserCommand(operator.id, id, dto.reason),
    );
    return { message: 'Administrator account deactivated successfully' };
  }

  @Patch(':id/activate')
  @RequirePermissions(AdminPermission.STAFF_ACTIVATE)
  @HttpCode(HttpStatus.OK)
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() operator: AuthenticatedUser,
  ) {
    await this.commandBus.execute(
      new ActivateAdminUserCommand(operator.id, id),
    );
    return { message: 'Administrator account reactivated successfully' };
  }
}
