import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../application/ports/token-service.port.js';
import { BaseJwtAuthGuard } from './base-jwt-auth.guard.js';

@Injectable()
export class OptionalJwtAuthGuard extends BaseJwtAuthGuard {
  constructor(
    @Inject(TOKEN_SERVICE_PORT)
    tokenService: TokenServicePort,
  ) {
    super(tokenService);
  }

  getExpectedScope(): 'customer' | 'admin' {
    return 'customer';
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Optional: allow guest requests without failing
    }
    return true;
  }
}
