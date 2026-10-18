import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateProfileCommand } from './update-profile.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<
  UpdateProfileCommand,
  CustomerResponseDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findById(command.id);

    if (!customer) {
      throw new ApplicationException(
        `Customer with id '${command.id}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    customer.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      phoneNumber: command.phoneNumber,
      avatarUrl: command.avatarUrl,
    });

    await this.customerRepository.save(customer);
    return CustomerResponseDto.fromDomain(customer);
  }
}
