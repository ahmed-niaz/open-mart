import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { GoogleAuthCommand } from './google-auth.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import { Customer } from '../../../domain/entities/customer.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(GoogleAuthCommand)
export class GoogleAuthHandler implements ICommandHandler<
  GoogleAuthCommand,
  AuthResponseDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: GoogleAuthCommand): Promise<AuthResponseDto> {
    if (!command.googleId || !command.email) {
      throw new ApplicationException(
        'Google ID and email are required',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const email = Email.create(command.email);

    // 1. Check if customer already exists with this googleId
    let customer = await this.customerRepository.findByGoogleId(
      command.googleId,
    );

    if (customer) {
      if (!customer.isActive) {
        throw new ApplicationException(
          'Customer account is deactivated. Please contact support.',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }

      customer.recordLogin();
      await this.customerRepository.save(customer);

      const customerDto = CustomerResponseDto.fromDomain(customer);
      const tokens = await this.tokenService.generateTokenPair({
        sub: customer.id.getValue(),
        email: customer.email.value,
        scope: 'customer',
      });

      return new AuthResponseDto(
        customerDto,
        tokens.accessToken,
        tokens.refreshToken,
      );
    }

    // 2. Check if customer exists by email (link existing credentials account to Google)
    customer = await this.customerRepository.findByEmail(email.value);

    if (customer) {
      if (!customer.isActive) {
        throw new ApplicationException(
          'Customer account is deactivated. Please contact support.',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }

      customer.linkGoogleAccount(command.googleId, command.avatarUrl);
      customer.recordLogin();
      await this.customerRepository.save(customer);

      const customerDto = CustomerResponseDto.fromDomain(customer);
      const tokens = await this.tokenService.generateTokenPair({
        sub: customer.id.getValue(),
        email: customer.email.value,
        scope: 'customer',
      });

      return new AuthResponseDto(
        customerDto,
        tokens.accessToken,
        tokens.refreshToken,
      );
    }

    // 3. Register brand-new customer with Google
    const customerAggregate = Customer.registerWithGoogle({
      email,
      googleId: command.googleId,
      firstName: command.firstName,
      lastName: command.lastName,
      avatarUrl: command.avatarUrl,
    });

    const newCustomer =
      this.eventPublisher.mergeObjectContext(customerAggregate);
    await this.customerRepository.save(newCustomer);
    newCustomer.commit();

    const customerDto = CustomerResponseDto.fromDomain(newCustomer);
    const tokens = await this.tokenService.generateTokenPair({
      sub: newCustomer.id.getValue(),
      email: newCustomer.email.value,
      scope: 'customer',
    });

    return new AuthResponseDto(
      customerDto,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }
}
