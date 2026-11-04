import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { LogoutAdminCommand } from './logout-admin.command.js';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepositoryPort,
} from '../../ports/admin-session.repository.js';
import { hashToken } from '../../../../shared/infrastructure/auth/token-hash.util.js';

@CommandHandler(LogoutAdminCommand)
export class LogoutAdminCommandHandler implements ICommandHandler<LogoutAdminCommand, void> {
  private readonly logger = new Logger(LogoutAdminCommandHandler.name);

  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY)
    private readonly sessionRepo: AdminSessionRepositoryPort,
  ) {}

  async execute(command: LogoutAdminCommand): Promise<void> {
    if (!command.refreshToken) {
      // No token to revoke — client-side cookie cleared
      return;
    }
    const tokenHash = hashToken(command.refreshToken);
    await this.sessionRepo.revokeByTokenHash(tokenHash);
    this.logger.log('Admin session revoked on logout.');
  }
}

