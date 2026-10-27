import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  buildCacheControlHeader,
  NO_CACHE_KEY,
  PUBLIC_CACHE_KEY,
  type PublicCacheOptions,
} from './public-cache.decorator.js';

export const DEFAULT_NO_CACHE_HEADER = 'no-store, private';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // 1. Secure-by-default: Ensure CDN and intermediate proxies do not cache
    // sensitive or private endpoints unless explicitly opt-in via @PublicCache.
    if (!res.headersSent) {
      res.setHeader('Cache-Control', DEFAULT_NO_CACHE_HEADER);
    }

    // 2. Mutating HTTP methods (POST, PUT, PATCH, DELETE) must NEVER be cached
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle();
    }

    // 3. Explicit opt-out via @NoCache()
    const isExplicitNoCache = this.reflector.getAllAndOverride<boolean>(
      NO_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isExplicitNoCache) {
      return next.handle();
    }

    // 4. Check for @PublicCache() metadata
    const cacheOptions = this.reflector.getAllAndOverride<PublicCacheOptions>(
      PUBLIC_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!cacheOptions) {
      return next.handle();
    }

    // 5. Bypass Edge cache if request specifically queries inactive, draft, or all items
    const queryStatus =
      typeof req.query?.status === 'string'
        ? req.query.status.toLowerCase().trim()
        : undefined;
    const queryIncludeInactive = req.query?.includeInactive === 'true';

    const isBypassRequested =
      queryIncludeInactive ||
      (queryStatus !== undefined && queryStatus !== 'active');

    if (isBypassRequested) {
      return next.handle();
    }

    // 6. On successful 2xx response, attach public Edge/CDN Cache-Control and Vary headers
    return next.handle().pipe(
      tap(() => {
        if (res.headersSent) return;

        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          const headerValue = buildCacheControlHeader(cacheOptions);
          res.setHeader('Cache-Control', headerValue);

          const existingVary = res.getHeader('Vary');
          if (!existingVary) {
            res.setHeader('Vary', 'Accept-Encoding');
          } else if (
            typeof existingVary === 'string' &&
            !existingVary.includes('Accept-Encoding')
          ) {
            res.setHeader('Vary', `${existingVary}, Accept-Encoding`);
          }
        }
      }),
    );
  }
}
