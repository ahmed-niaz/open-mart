import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { IdempotencyService } from './idempotency.service.js';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawKey = req.headers['x-idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      return next.handle();
    }

    const key = rawKey.trim();
    if (!key) {
      return next.handle();
    }

    const user = (req as any).user;
    const body = req.body;
    const guestEmail = body?.customer?.email;

    const scope = user?.id
      ? `user:${user.id}`
      : guestEmail
        ? `guest:${String(guestEmail).toLowerCase().trim()}`
        : 'guest:anonymous';

    const requestPath = req.originalUrl?.split('?')[0] || req.path;

    // Check pre-existing key
    const check = await this.idempotencyService.checkKey(
      key,
      scope,
      requestPath,
      body,
    );

    if (check.cached) {
      const status = check.responseCode || 200;
      res.status(status);
      return of(check.responseBody);
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        // Cache successful response (2xx) if not already committed in the command transaction
        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          try {
            await this.idempotencyService.recordCompleted(
              null, // use pool
              key,
              scope,
              requestPath,
              body,
              statusCode,
              responseBody,
            );
          } catch {
            // Ignore race condition if already written inside the command transaction
          }
        }
      }),
    );
  }
}

