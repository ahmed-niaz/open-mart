import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { ListAdminAuditLogsQuery } from '../../application/queries/list-admin-audit-logs/list-admin-audit-logs.query.js';
import { ListAdminAuditQueryDto } from '../dto/list-admin-audit-query.dto.js';
import { AdminJwtGuard } from '../../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../../shared/infrastructure/guards/admin-permissions.js';

@Controller('admin/audit-logs')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class AdminAuditController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @RequirePermissions(AdminPermission.AUDIT_READ)
  async listLogs(@Query() query: ListAdminAuditQueryDto) {
    return this.queryBus.execute(
      new ListAdminAuditLogsQuery(
        query.page,
        query.limit,
        query.adminId,
        query.action,
      ),
    );
  }
}
