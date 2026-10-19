import { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { TokenServicePort } from '../../application/ports/token-service.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';
import '../../presentation/interfaces/authenticated-user.interface.js';

export abstract class BaseJwtAuthGuard implements CanActivate {
  constructor(protected readonly tokenService: TokenServicePort) {}

  abstract getExpectedScope(): 'customer' | 'admin';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new ApplicationException(
        'Authentication required. Please provide a valid Bearer token in the Authorization header.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const payload = await this.tokenService.verifyAccessToken(token);

    if (payload.scope !== this.getExpectedScope()) {
      throw new ApplicationException(
        `Forbidden: Access denied. Token scope '${payload.scope}' is not authorized for this resource.`,
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      scope: payload.scope,
      role: payload.role,
    };

    return true;
  }

  protected extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

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
