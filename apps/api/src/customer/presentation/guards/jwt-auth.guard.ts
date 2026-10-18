import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new ApplicationException(
        'Authentication required. Please provide a valid Bearer token in the Authorization header.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    try {
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
        this.configService.get<string>(
          'JWT_SECRET',
          'open-mart-customer-jwt-secret-key-2026-secure-fallback',
        );

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token, { secret });

      request.user = {
        id: payload.sub,
        email: payload.email,
      };

      return true;
    } catch {
      throw new ApplicationException(
        'Invalid or expired authentication token. Please log in again.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // Optional fallback to cookie if browser passes auth_token cookie
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader
        .split(';')
        .reduce<Record<string, string>>((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key && value) {
            acc[key] = decodeURIComponent(value);
          }
          return acc;
        }, {});

      if (cookies['auth_token']) return cookies['auth_token'];
      if (cookies['accessToken']) return cookies['accessToken'];
    }

    return undefined;
  }
}
