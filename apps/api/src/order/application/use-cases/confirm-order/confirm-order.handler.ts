import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmOrderCommand } from './confirm-order.command.js';
import { OrderResponseDto } from '../../dto/order-response.dto.js';
import {
  ORDER_REPOSITORY,
  type OrderRepositoryPort,
} from '../../ports/order.repository.js';
import {
  DISCOUNT_CALCULATION_PORT,
  type DiscountCalculationPort,
} from '../../ports/discount-calculation.port.js';
import { OrderId } from '../../../domain/value-objects/order-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(ConfirmOrderCommand)
export class ConfirmOrderCommandHandler implements ICommandHandler<
  ConfirmOrderCommand,
  OrderResponseDto
> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(DISCOUNT_CALCULATION_PORT)
    private readonly discountCalculation: DiscountCalculationPort,
  ) {}

  async execute(command: ConfirmOrderCommand): Promise<OrderResponseDto> {
    const orderId = OrderId.fromString(command.orderId);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ApplicationException(
        `Order with ID '${command.orderId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (order.status.getValue() === 'confirmed') {
      return OrderResponseDto.fromDomain(order);
    }

    order.confirm();
    await this.orderRepository.save(order);

    if (order.discountCode) {
      await this.discountCalculation.confirm(order.id.getValue());
    }

    return OrderResponseDto.fromDomain(order);
  }
}
