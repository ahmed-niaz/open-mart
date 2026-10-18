import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ActivateCustomerCommand } from './activate-customer.command.js';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../../ports/customer.repository.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(ActivateCustomerCommand)
export class ActivateCustomerHandler implements ICommandHandler<
  ActivateCustomerCommand,
  void
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(command: ActivateCustomerCommand): Promise<void> {
    const customer = await this.customerRepository.findById(command.id);

    if (!customer) {
      throw new ApplicationException(
        `Customer with id '${command.id}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    customer.activate();
    await this.customerRepository.save(customer);
  }
}
