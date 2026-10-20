import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProcessOrderCommand } from './process-order.command.js';
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

@CommandHandler(ProcessOrderCommand)
export class ProcessOrderCommandHandler implements ICommandHandler<
  ProcessOrderCommand,
  OrderResponseDto
> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(command: ProcessOrderCommand): Promise<OrderResponseDto> {
    const orderId = OrderId.fromString(command.orderId);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ApplicationException(
        `Order with ID '${command.orderId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    order.process();
    await this.orderRepository.save(order);

    return OrderResponseDto.fromDomain(order);
  }
}
