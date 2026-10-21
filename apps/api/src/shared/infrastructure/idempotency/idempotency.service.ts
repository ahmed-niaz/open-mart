import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { createHash } from 'node:crypto';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';
import { idempotencyKeysSchema } from '../database/postgres/schema/idempotency.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';

export interface IdempotencyCheckResult {
  cached: boolean;
  responseCode?: number;
  responseBody?: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Deterministically computes SHA-256 hash of a normalized JSON payload.
   */
  computeHash(payload: any): string {
    if (payload === undefined || payload === null) {
      return createHash('sha256').update('').digest('hex');
    }

    const canonicalJson = this.canonicalStringify(payload);
    return createHash('sha256').update(canonicalJson).digest('hex');
  }

  /**
   * Checks whether a request with this key was already made or is currently in flight.
   * Throws 422 if payload changed; throws 409 if in-flight.
   */
  async checkKey(
    key: string,
    scope: string,
    requestPath: string,
    payload: any,
  ): Promise<IdempotencyCheckResult> {
    const currentHash = this.computeHash(payload);

    const rows = await this.db
      .select()
      .from(idempotencyKeysSchema)
      .where(
        and(
          eq(idempotencyKeysSchema.key, key),
          eq(idempotencyKeysSchema.scope, scope),
          eq(idempotencyKeysSchema.requestPath, requestPath),
          gt(idempotencyKeysSchema.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return { cached: false };
    }

    const existing = rows[0];

    // Payload mismatch -> 422 Unprocessable Entity
    if (existing.requestHash !== currentHash) {
      this.logger.warn(
        `Idempotency payload divergence for key '${key}' at '${requestPath}'. Existing: ${existing.requestHash}, Current: ${currentHash}`,
      );
      throw new ApplicationException(
        'Idempotency key reused with different request payload',
        ApplicationExceptionCode.UNPROCESSABLE_ENTITY,
      );
    }

    // In-progress lock check (2-minute window for active execution)
    if (existing.status === 'in_progress') {
      const lockAgeMs = Date.now() - existing.createdAt.getTime();
      if (lockAgeMs < 120_000) {
        throw new ApplicationException(
          'A request with this idempotency key is currently being processed. Please retry shortly.',
          ApplicationExceptionCode.CONFLICT,
        );
      }
      // Stale crashed lock (> 2 mins) -> allow retry
      return { cached: false };
    }

    // Completed response cached -> return saved body & HTTP code
    if (existing.status === 'completed') {
      return {
        cached: true,
        responseCode: existing.responseCode ?? 200,
        responseBody: existing.responseBody,
      };
    }

    return { cached: false };
  }

  /**
   * Atomically records completion inside the caller's database transaction.
   */
  async recordCompleted(
    tx: any,
    key: string,
    scope: string,
    requestPath: string,
    payload: any,
    responseCode: number,
    responseBody: any,
    ttlHours = 24,
  ): Promise<void> {
    const executor = tx || this.db;
    const requestHash = this.computeHash(payload);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    await executor
      .insert(idempotencyKeysSchema)
      .values({
        key,
        scope,
        requestPath,
        requestHash,
        status: 'completed',
        responseCode,
        responseBody,
        createdAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          idempotencyKeysSchema.key,
          idempotencyKeysSchema.scope,
          idempotencyKeysSchema.requestPath,
        ],
        set: {
          requestHash,
          status: 'completed',
          responseCode,
          responseBody,
          expiresAt,
        },
      });

    this.logger.debug(
      `Idempotency record completed for [${key}] scope=${scope} path=${requestPath}`,
    );
  }

  /**
   * Recursively sorts object keys for canonical serialization.
   */
  private canonicalStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalStringify(item)).join(',')}]`;
    }
    const keys = Object.keys(obj).sort();
    const entries = keys.map(
      (k) => `${JSON.stringify(k)}:${this.canonicalStringify(obj[k])}`,
    );
    return `{${entries.join(',')}}`;
  }
}

