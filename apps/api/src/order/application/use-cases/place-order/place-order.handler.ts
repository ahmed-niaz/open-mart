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
  INVENTORY_RESERVATION_PORT,
  type InventoryReservationPort,
} from '../../../../inventory/application/ports/inventory-reservation.port.js';
import {
  DISCOUNT_CALCULATION_PORT,
  type DiscountCalculationPort,
  type CalculatedDiscountResult,
} from '../../ports/discount-calculation.port.js';
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
    @Inject(INVENTORY_RESERVATION_PORT)
    private readonly inventoryReservationPort: InventoryReservationPort,
    @Inject(DISCOUNT_CALCULATION_PORT)
    private readonly discountCalculation: DiscountCalculationPort,
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
    }

    // Optional coupon discount calculation
    let discountResult: CalculatedDiscountResult | null = null;
    const customerIdentifier = command.customerId
      ? command.customerId
      : command.guestCustomer?.email ||
        (command.shippingAddress as any)?.recipientPhone ||
        'guest';

    if (command.couponCode && command.couponCode.trim().length > 0) {
      discountResult = await this.discountCalculation.calculate({
        code: command.couponCode.trim(),
        customerId: command.customerId,
        guestEmail: command.guestCustomer?.email,
        items: command.items.map((i) => {
          const prod = productMap.get(i.productId)!;
          return {
            productId: prod.id,
            categoryId: prod.categoryId,
            unitPrice: prod.unitPriceAmount,
            quantity: i.quantity,
          };
        }),
        shippingFee: 0,
      });
    }

    const orderItems: OrderItem[] = [];

    for (const itemInput of command.items) {
      const product = productMap.get(itemInput.productId)!;
      const unitPrice = Money.fromCents(
        product.unitPriceAmount,
        product.unitPriceCurrency,
      );

      const allocated = discountResult?.allocatedLines.find(
        (l) => l.productId === product.id,
      );
      const discountItemAmount = allocated
        ? Money.fromCents(allocated.allocatedAmount, product.unitPriceCurrency)
        : Money.zero(product.unitPriceCurrency);

      const item = OrderItem.create({
        productId: product.id,
        productName: product.title,
        productSku: product.sku,
        unitPrice,
        quantity: itemInput.quantity,
        discountAmount: discountItemAmount,
      });

      orderItems.push(item);
    }

    const shippingAddress = ShippingAddress.create(command.shippingAddress);

    const discountSnapshot = discountResult
      ? {
          code: discountResult.code,
          type: discountResult.type,
          amount: Money.fromCents(
            discountResult.totalDiscountAmount,
            orderItems[0].unitPrice.getCurrency(),
          ),
        }
      : null;

    const order = Order.place(
      command.customerId,
      orderItems,
      shippingAddress,
      command.notes,
      discountSnapshot,
    );

    // Save initial order in pending state
    await this.orderRepository.save(order);

    try {
      // Two-phase discount reservation
      if (discountResult) {
        await this.discountCalculation.reserve(
          discountResult.discountId,
          order.id.getValue(),
          command.customerId,
          customerIdentifier,
          discountResult.code,
          discountResult.totalDiscountAmount,
        );
      }

      // Two-Phase Reservation: Atomically hold stock for the order (30 min TTL)
      await this.inventoryReservationPort.reserveStock(
        order.id.getValue(),
        orderItems.map((i) => ({
          sku: i.productSku,
          quantity: i.quantity,
        })),
        30,
      );
    } catch (error) {
      if (discountResult) {
        try {
          await this.discountCalculation.release(order.id.getValue());
        } catch {
          // ignore rollback release errors
        }
      }
      throw error;
    }

    return OrderResponseDto.fromDomain(order);
  }
}
