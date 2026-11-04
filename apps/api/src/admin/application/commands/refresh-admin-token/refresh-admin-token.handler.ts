import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RefreshAdminTokenCommand } from './refresh-admin-token.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepositoryPort,
} from '../../ports/admin-session.repository.js';
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
import { hashToken } from '../../../../shared/infrastructure/auth/token-hash.util.js';

@CommandHandler(RefreshAdminTokenCommand)
export class RefreshAdminTokenCommandHandler implements ICommandHandler<
  RefreshAdminTokenCommand,
  TokenPair
> {
  private readonly logger = new Logger(RefreshAdminTokenCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_SESSION_REPOSITORY)
    private readonly sessionRepo: AdminSessionRepositoryPort,
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

    // 1. Verify JWT signature & expiry
    const payload = await this.tokenService.verifyRefreshToken(
      command.refreshToken,
    );

    if (payload.scope !== 'admin') {
      throw new ApplicationException(
        'Invalid token scope. Admin refresh token required.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    // 2. Verify DB session is active (not revoked, not expired)
    const tokenHash = hashToken(command.refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      this.logger.warn(
        `Refresh token not found or already revoked for admin ${payload.sub}. Possible token theft.`,
      );
      // Revoke ALL sessions for this admin — token reuse = suspected theft
      await this.sessionRepo.revokeAllByAdminId(payload.sub);
      throw new ApplicationException(
        'Session not found or revoked. Please sign in again.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (session.expiresAt < new Date()) {
      await this.sessionRepo.revokeByTokenHash(tokenHash);
      throw new ApplicationException(
        'Session has expired. Please sign in again.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    // 3. Verify admin still active
    const admin = await this.adminRepo.findById(AdminId.create(payload.sub));
    if (!admin || !admin.isActive) {
      await this.sessionRepo.revokeAllByAdminId(payload.sub);
      throw new ApplicationException(
        'Account is deactivated or does not exist. Token revoked.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    // 4. Rotate: revoke old session, create new session
    await this.sessionRepo.revokeByTokenHash(tokenHash);

    const newTokenPair = await this.tokenService.generateTokenPair({
      sub: admin.id.value,
      email: admin.email.value,
      scope: 'admin',
      role: admin.role.value,
    });

    const newHash = hashToken(newTokenPair.refreshToken);
    const expiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenMaxAgeMs());
    await this.sessionRepo.create({
      adminId: admin.id.value,
      tokenHash: newHash,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      expiresAt,
    });

    return newTokenPair;
  }
}
