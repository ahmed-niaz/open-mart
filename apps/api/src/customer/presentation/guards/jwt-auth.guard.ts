import { Inject, Injectable } from '@nestjs/common';

import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../shared/application/ports/token-service.port.js';
import { BaseJwtAuthGuard } from '../../../shared/infrastructure/guards/base-jwt-auth.guard.js';

export type { AuthenticatedUser } from '../../../shared/presentation/interfaces/authenticated-user.interface.js';

@Injectable()
export class JwtAuthGuard extends BaseJwtAuthGuard {
  constructor(
    @Inject(TOKEN_SERVICE_PORT)
    tokenService: TokenServicePort,
  ) {
    super(tokenService);
  }

  getExpectedScope(): 'customer' | 'admin' {
    return 'customer';
  }
}
