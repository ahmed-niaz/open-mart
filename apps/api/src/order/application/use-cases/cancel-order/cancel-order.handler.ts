import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CancelOrderCommand } from './cancel-order.command.js';
import { OrderResponseDto } from '../../dto/order-response.dto.js';
import {
  ORDER_REPOSITORY,
  type OrderRepositoryPort,
} from '../../ports/order.repository.js';
import { OrderId } from '../../../domain/value-objects/order-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(CancelOrderCommand)
export class CancelOrderCommandHandler implements ICommandHandler<
  CancelOrderCommand,
  OrderResponseDto
> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(command: CancelOrderCommand): Promise<OrderResponseDto> {
    const orderId = OrderId.fromString(command.orderId);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ApplicationException(
        `Order with ID '${command.orderId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // Security & status check: Customer can only cancel their own order while pending or confirmed
    if (command.requestingCustomerId) {
      if (order.customerId !== command.requestingCustomerId) {
        throw new ApplicationException(
          'Forbidden: You are not authorized to cancel an order that belongs to another customer',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
      if (!order.status.isPending() && !order.status.isConfirmed()) {
        throw new ApplicationException(
          `Customer cancellation is only allowed while the order is pending or confirmed. Current status: '${order.status.getValue()}'`,
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }
    }

    order.cancel(command.reason);
    await this.orderRepository.save(order);

    return OrderResponseDto.fromDomain(order);
  }
}
