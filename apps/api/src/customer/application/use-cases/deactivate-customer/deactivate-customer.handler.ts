import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeactivateCustomerCommand } from './deactivate-customer.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeactivateCustomerCommand)
export class DeactivateCustomerHandler implements ICommandHandler<
  DeactivateCustomerCommand,
  void
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(command: DeactivateCustomerCommand): Promise<void> {
    const customer = await this.customerRepository.findById(command.id);

    if (!customer) {
      throw new ApplicationException(
        `Customer with id '${command.id}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    customer.deactivate();
    await this.customerRepository.save(customer);
  }
}
