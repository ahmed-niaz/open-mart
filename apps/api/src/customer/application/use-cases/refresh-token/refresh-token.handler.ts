import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RefreshTokenCommand } from './refresh-token.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import { TokenResponseDto } from '../../dto/token-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<
  RefreshTokenCommand,
  TokenResponseDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<TokenResponseDto> {
    if (!command.refreshToken) {
      throw new ApplicationException(
        'Refresh token is required',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const payload = await this.tokenService.verifyRefreshToken(
      command.refreshToken,
    );

    if (payload.scope !== 'customer') {
      throw new ApplicationException(
        'Invalid token scope for customer refresh',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const customer = await this.customerRepository.findById(payload.sub);

    if (!customer) {
      throw new ApplicationException(
        'Customer not found or no longer exists',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!customer.isActive) {
      throw new ApplicationException(
        'Customer account is deactivated. Please contact support.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const tokens = await this.tokenService.generateTokenPair({
      sub: customer.id.getValue(),
      email: customer.email.value,
      scope: 'customer',
    });

    return new TokenResponseDto(tokens.accessToken, tokens.refreshToken);
  }
}
