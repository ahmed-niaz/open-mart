import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Response } from 'express';

import {
  GOOGLE_AUTH_PORT,
  type GoogleAuthPort,
} from '../application/ports/google-auth.port.js';
import { GoogleAuthCommand } from '../application/use-cases/google-auth/google-auth.command.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../shared/domain/exceptions/application.exception.js';
import type { AuthResponseDto } from '../application/dto/auth-response.dto.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../shared/application/ports/token-service.port.js';
import { AuthCookieHelper } from '../../shared/infrastructure/auth/auth-cookie.helper.js';

@Controller('google')
export class GoogleAuthController {
  constructor(
    @Inject(GOOGLE_AUTH_PORT)
    private readonly googleAuth: GoogleAuthPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * GET /api/google
   * Redirects user to Google OAuth consent screen
   */
  @Get()
  redirectToGoogle(@Res() res: Response) {
    const authUrl = this.googleAuth.getAuthorizationUrl();
    return res.redirect(authUrl);
  }

  /**
   * GET /api/google/callback
   * Handles Google OAuth callback redirect with authorization code
   */
  @Get('callback')
  async handleCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('error') error?: string,
    @Query('state') state?: string,
  ) {
    if (error) {
      throw new ApplicationException(
        `Google authorization denied: ${error}`,
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!code) {
      throw new ApplicationException(
        'Missing authorization code in Google callback',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const profile = await this.googleAuth.exchangeCodeForProfile(code);

    const result = await this.commandBus.execute<
      GoogleAuthCommand,
      AuthResponseDto
    >(
      new GoogleAuthCommand(
        profile.googleId,
        profile.email,
        profile.firstName,
        profile.lastName,
        profile.avatarUrl,
      ),
    );

    // Set secure cookies for browser sessions
    AuthCookieHelper.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      {
        accessTokenMaxAgeMs: this.tokenService.getAccessTokenMaxAgeMs(),
        refreshTokenMaxAgeMs: this.tokenService.getRefreshTokenMaxAgeMs(),
      },
      '/api/customers',
    );

    // If state contains a redirect target, redirect there with tokens
    if (
      state &&
      (state.startsWith('http://') ||
        state.startsWith('https://') ||
        state.startsWith('/'))
    ) {
      const redirectUrl = new URL(state, 'http://localhost:3000');
      redirectUrl.searchParams.set('token', result.accessToken);
      redirectUrl.searchParams.set('refreshToken', result.refreshToken);
      return res.redirect(redirectUrl.toString());
    }

    return res.status(HttpStatus.OK).json({ data: result });
  }

  /**
   * POST /api/google/token
   * Programmatic token exchange for SPA frontend (Next.js) or mobile clients
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async exchangeToken(@Body('code') code: string) {
    if (!code) {
      throw new ApplicationException(
        'Authorization code is required',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const profile = await this.googleAuth.exchangeCodeForProfile(code);

    const result = await this.commandBus.execute<
      GoogleAuthCommand,
      AuthResponseDto
    >(
      new GoogleAuthCommand(
        profile.googleId,
        profile.email,
        profile.firstName,
        profile.lastName,
        profile.avatarUrl,
      ),
    );

    return { data: result };
  }
}
