import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';

import { LoginAdminCommand } from '../../application/commands/login-admin/login-admin.command.js';
import { RefreshAdminTokenCommand } from '../../application/commands/refresh-admin-token/refresh-admin-token.command.js';
import { ChangeAdminPasswordCommand } from '../../application/commands/change-admin-password/change-admin-password.command.js';
import { GetAdminProfileQuery } from '../../application/queries/get-admin-profile/get-admin-profile.query.js';
import { LoginAdminDto } from '../dto/login-admin.dto.js';
import { ChangeAdminPasswordDto } from '../dto/change-admin-password.dto.js';
import type { AdminAuthResponseDto } from '../../application/dto/admin-auth-response.dto.js';
import { AdminJwtGuard } from '../../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../../shared/infrastructure/guards/permissions.guard.js';
import { CurrentAdmin } from '../../../shared/presentation/decorators/current-admin.decorator.js';
import { AllowPendingPasswordChange } from '../../../shared/presentation/decorators/allow-pending-password-change.decorator.js';
import { RequirePermissions } from '../../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../../shared/infrastructure/guards/admin-permissions.js';
import type { AuthenticatedUser } from '../../../shared/presentation/interfaces/authenticated-user.interface.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenPair,
  type TokenServicePort,
} from '../../../shared/application/ports/token-service.port.js';
import { AuthCookieHelper } from '../../../shared/infrastructure/auth/auth-cookie.helper.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

function extractClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

const ADMIN_AUTH_COOKIE_PATH = '/api/admin/auth';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginAdminDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    const result = await this.commandBus.execute<
      LoginAdminCommand,
      AdminAuthResponseDto
    >(new LoginAdminCommand(dto.email, dto.password, ip, userAgent));

    AuthCookieHelper.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      {
        accessTokenMaxAgeMs: this.tokenService.getAccessTokenMaxAgeMs(),
        refreshTokenMaxAgeMs: this.tokenService.getRefreshTokenMaxAgeMs(),
      },
      ADMIN_AUTH_COOKIE_PATH,
    );

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    const rawRefreshToken =
      AuthCookieHelper.extractCookie(req, 'refresh_token') ||
      req.headers['x-refresh-token'];

    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new ApplicationException(
        'Refresh token required in cookie or header.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const tokenPair = await this.commandBus.execute<
      RefreshAdminTokenCommand,
      TokenPair
    >(new RefreshAdminTokenCommand(rawRefreshToken));

    AuthCookieHelper.setAuthCookies(
      res,
      tokenPair.accessToken,
      tokenPair.refreshToken,
      {
        accessTokenMaxAgeMs: this.tokenService.getAccessTokenMaxAgeMs(),
        refreshTokenMaxAgeMs: this.tokenService.getRefreshTokenMaxAgeMs(),
      },
      ADMIN_AUTH_COOKIE_PATH,
    );

    return tokenPair;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    AuthCookieHelper.clearAuthCookies(res, ADMIN_AUTH_COOKIE_PATH);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  async getProfile(@CurrentAdmin() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetAdminProfileQuery(user.id));
  }

  @Patch('password')
  @UseGuards(AdminJwtGuard, PermissionsGuard)
  @AllowPendingPasswordChange()
  @RequirePermissions(AdminPermission.STAFF_READ)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentAdmin() user: AuthenticatedUser,
    @Body() dto: ChangeAdminPasswordDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(
      new ChangeAdminPasswordCommand(
        user.id,
        dto.newPassword,
        dto.currentPassword,
      ),
    );
    return { message: 'Password updated successfully' };
  }
}
