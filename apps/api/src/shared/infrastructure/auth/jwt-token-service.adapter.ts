import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import {
  TokenPair,
  TokenPayload,
  TokenServicePort,
} from '../../application/ports/token-service.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';

@Injectable()
export class JwtTokenServiceAdapter implements TokenServicePort {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'access_secret';

    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_REFERSH_TOKEN_SECRET') ??
      'refresh-token-secret';

    this.accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES') ?? '1d';

    this.refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES') ?? '27d';
  }

  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const claims = {
      sub: payload.sub,
      email: payload.email,
      scope: payload.scope,
      ...(payload.role ? { role: payload.role } : {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(claims, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as any,
      }),
      this.jwtService.signAsync(claims, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.accessSecret,
      });
      return payload;
    } catch {
      throw new ApplicationException(
        'Invalid or expired access token. Please authenticate again.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.refreshSecret,
      });
      return payload;
    } catch {
      throw new ApplicationException(
        'Invalid or expired refresh token. Please sign in again.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }
  }

  getAccessTokenMaxAgeMs(): number {
    return this.parseDurationToMs(this.accessExpiresIn, 24 * 60 * 60 * 1000);
  }

  getRefreshTokenMaxAgeMs(): number {
    return this.parseDurationToMs(
      this.refreshExpiresIn,
      27 * 24 * 60 * 60 * 1000,
    );
  }

  private parseDurationToMs(duration: string, defaultMs: number): number {
    if (!duration) return defaultMs;
    const match = duration
      .toString()
      .trim()
      .match(/^(\d+)([smhd])$/i);
    if (!match) return defaultMs;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return defaultMs;
    }
  }
}
