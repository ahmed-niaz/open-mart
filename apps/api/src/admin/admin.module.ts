import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';

import { ADMIN_USER_REPOSITORY } from './application/ports/admin-user.repository.js';
import { ADMIN_AUDIT_PORT } from './application/ports/admin-audit.port.js';
import { ADMIN_GOOGLE_AUTH_PORT } from './application/ports/admin-google-auth.port.js';
import { DrizzleAdminUserRepository } from './infrastructure/adapters/drizzle-admin-user.repository.js';
import { DrizzleAdminAuditAdapter } from './infrastructure/adapters/drizzle-admin-audit.adapter.js';
import { AdminGoogleAuthAdapter } from './infrastructure/adapters/drizzle-admin-google-auth.adapter.js';
import { InitialAdminSeeder } from './infrastructure/seeders/initial-admin.seeder.js';

// Command Handlers
import { LoginAdminCommandHandler } from './application/commands/login-admin/login-admin.handler.js';
import { RegisterAdminCommandHandler } from './application/commands/register-admin/register-admin.handler.js';
import { LoginAdminGoogleCommandHandler } from './application/commands/login-admin-google/login-admin-google.handler.js';
import { RefreshAdminTokenCommandHandler } from './application/commands/refresh-admin-token/refresh-admin-token.handler.js';
import { CreateAdminUserCommandHandler } from './application/commands/create-admin-user/create-admin-user.handler.js';
import { UpdateAdminUserCommandHandler } from './application/commands/update-admin-user/update-admin-user.handler.js';
import { ChangeAdminRoleCommandHandler } from './application/commands/change-admin-role/change-admin-role.handler.js';
import { ChangeAdminPasswordCommandHandler } from './application/commands/change-admin-password/change-admin-password.handler.js';
import { DeactivateAdminUserCommandHandler } from './application/commands/deactivate-admin-user/deactivate-admin-user.handler.js';
import { ActivateAdminUserCommandHandler } from './application/commands/activate-admin-user/activate-admin-user.handler.js';

// Query Handlers
import { GetAdminProfileQueryHandler } from './application/queries/get-admin-profile/get-admin-profile.handler.js';
import { GetAdminUserByIdQueryHandler } from './application/queries/get-admin-user-by-id/get-admin-user-by-id.handler.js';
import { ListAdminUsersQueryHandler } from './application/queries/list-admin-users/list-admin-users.handler.js';
import { ListAdminAuditLogsQueryHandler } from './application/queries/list-admin-audit-logs/list-admin-audit-logs.handler.js';

// Controllers
import { AdminAuthController } from './presentation/controllers/admin-auth.controller.js';
import { AdminUsersController } from './presentation/controllers/admin-users.controller.js';
import { AdminAuditController } from './presentation/controllers/admin-audit.controller.js';

// Shared Guards
import { AdminJwtGuard } from '../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../shared/infrastructure/guards/permissions.guard.js';

const CommandHandlers = [
  LoginAdminCommandHandler,
  RegisterAdminCommandHandler,
  LoginAdminGoogleCommandHandler,
  RefreshAdminTokenCommandHandler,
  CreateAdminUserCommandHandler,
  UpdateAdminUserCommandHandler,
  ChangeAdminRoleCommandHandler,
  ChangeAdminPasswordCommandHandler,
  DeactivateAdminUserCommandHandler,
  ActivateAdminUserCommandHandler,
];

const QueryHandlers = [
  GetAdminProfileQueryHandler,
  GetAdminUserByIdQueryHandler,
  ListAdminUsersQueryHandler,
  ListAdminAuditLogsQueryHandler,
];

@Module({
  imports: [CqrsModule, ConfigModule, AuthModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminAuditController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: ADMIN_USER_REPOSITORY,
      useClass: DrizzleAdminUserRepository,
    },
    {
      provide: ADMIN_AUDIT_PORT,
      useClass: DrizzleAdminAuditAdapter,
    },
    {
      provide: ADMIN_GOOGLE_AUTH_PORT,
      useClass: AdminGoogleAuthAdapter,
    },
    InitialAdminSeeder,
    AdminJwtGuard,
    PermissionsGuard,
  ],
  exports: [
    ADMIN_USER_REPOSITORY,
    ADMIN_AUDIT_PORT,
    ADMIN_GOOGLE_AUTH_PORT,
    AdminJwtGuard,
    PermissionsGuard,
  ],
})
export class AdminModule {}
