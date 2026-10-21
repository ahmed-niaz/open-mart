import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RefreshAdminTokenCommand } from './refresh-admin-token.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenPair,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import { AdminId } from '../../../domain/value-objects/admin-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RefreshAdminTokenCommand)
export class RefreshAdminTokenCommandHandler implements ICommandHandler<
  RefreshAdminTokenCommand,
  TokenPair
> {
  private readonly logger = new Logger(RefreshAdminTokenCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(command: RefreshAdminTokenCommand): Promise<TokenPair> {
    if (!command.refreshToken) {
      throw new ApplicationException(
        'Refresh token is required.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const payload = await this.tokenService.verifyRefreshToken(
      command.refreshToken,
    );

    if (payload.scope !== 'admin') {
      throw new ApplicationException(
        'Invalid token scope. Admin refresh token required.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const admin = await this.adminRepo.findById(AdminId.create(payload.sub));

    if (!admin || !admin.isActive) {
      throw new ApplicationException(
        'Account is deactivated or does not exist. Token revoked.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    return this.tokenService.generateTokenPair({
      sub: admin.id.value,
      email: admin.email.value,
      scope: 'admin',
      role: admin.role.value,
    });
  }
}
