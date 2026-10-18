import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';

import { LoginCustomerCommand } from './login-customer.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../ports/password-hasher.port.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(LoginCustomerCommand)
export class LoginCustomerHandler implements ICommandHandler<
  LoginCustomerCommand,
  AuthResponseDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginCustomerCommand): Promise<AuthResponseDto> {
    const email = Email.create(command.email);
    const customer = await this.customerRepository.findByEmail(email.value);

    if (!customer) {
      throw new ApplicationException(
        'Invalid email or password',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!customer.isActive) {
      throw new ApplicationException(
        'Customer account is deactivated. Please contact support.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    if (!customer.passwordHash) {
      throw new ApplicationException(
        'This account was registered using Google Sign-In. Please sign in with Google.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const isMatch = await this.passwordHasher.compare(
      command.password,
      customer.passwordHash.value,
    );

    if (!isMatch) {
      throw new ApplicationException(
        'Invalid email or password',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    customer.recordLogin();
    await this.customerRepository.save(customer);

    const customerDto = CustomerResponseDto.fromDomain(customer);
    const accessToken = await this.jwtService.signAsync({
      sub: customer.id.getValue(),
      email: customer.email.value,
    });

    return new AuthResponseDto(customerDto, accessToken);
  }
}
