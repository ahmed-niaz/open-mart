import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlaceOrderCommand } from './place-order.command.js';
import { OrderResponseDto } from '../../dto/order-response.dto.js';
import {
  ORDER_REPOSITORY,
  type OrderRepositoryPort,
} from '../../ports/order.repository.js';
import {
  PRODUCT_VERIFICATION_PORT,
  type ProductVerificationPort,
} from '../../ports/product-verification.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { ShippingAddress } from '../../../domain/value-objects/shipping-address.vo.js';
import { OrderItem } from '../../../domain/entities/order-item.entity.js';
import { Order } from '../../../domain/entities/order.entity.js';

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderCommandHandler implements ICommandHandler<
  PlaceOrderCommand,
  OrderResponseDto
> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(PRODUCT_VERIFICATION_PORT)
    private readonly productVerification: ProductVerificationPort,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderResponseDto> {
    if (!command.items || command.items.length === 0) {
      throw new ApplicationException(
        'An order must contain at least one item',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const productIds = command.items.map((i) => i.productId);
    const productMap =
      await this.productVerification.getProductsByIds(productIds);

    const orderItems: OrderItem[] = [];

    for (const itemInput of command.items) {
      const product = productMap.get(itemInput.productId);
      if (!product) {
        throw new ApplicationException(
          `Product with ID '${itemInput.productId}' does not exist or is not available for purchase`,
          ApplicationExceptionCode.NOT_FOUND,
        );
      }

      if (product.status !== 'active' && product.status !== 'published') {
        throw new ApplicationException(
          `Product '${product.title}' is not currently available for purchase (status: ${product.status})`,
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }

      const unitPrice = Money.fromCents(
        product.unitPriceAmount,
        product.unitPriceCurrency,
      );

      const item = OrderItem.create({
        productId: product.id,
        productName: product.title,
        productSku: product.sku,
        unitPrice,
        quantity: itemInput.quantity,
      });

      orderItems.push(item);
    }

    const shippingAddress = ShippingAddress.create(command.shippingAddress);

    const order = Order.place(
      command.customerId,
      orderItems,
      shippingAddress,
      command.notes,
    );

    await this.orderRepository.save(order);

    return OrderResponseDto.fromDomain(order);
  }
}
