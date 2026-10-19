import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { RegisterCustomerCommand } from './register-customer.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../../../shared/application/ports/password-hasher.port.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import { Customer } from '../../../domain/entities/customer.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RegisterCustomerCommand)
export class RegisterCustomerHandler implements ICommandHandler<
  RegisterCustomerCommand,
  AuthResponseDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: RegisterCustomerCommand): Promise<AuthResponseDto> {
    const email = Email.create(command.email);

    const exists = await this.customerRepository.existsByEmail(email.value);
    if (exists) {
      throw new ApplicationException(
        `Customer with email '${command.email}' already exists`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    if (!command.password || command.password.length < 8) {
      throw new ApplicationException(
        'Password must be at least 8 characters long',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const hashed = await this.passwordHasher.hash(command.password);
    const passwordHash = PasswordHash.create(hashed);

    const customerAggregate = Customer.registerWithCredentials({
      email,
      passwordHash,
      firstName: command.firstName,
      lastName: command.lastName,
      phoneNumber: command.phoneNumber,
    });

    const customer = this.eventPublisher.mergeObjectContext(customerAggregate);
    await this.customerRepository.save(customer);
    customer.commit();

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
}
