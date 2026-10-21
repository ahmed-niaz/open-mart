import type {
  OrderItemSelectRow,
  OrderSelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import type { Order } from '../../domain/entities/order.entity.js';
import type { ShippingAddressProps } from '../../domain/value-objects/shipping-address.vo.js';
import { OrderItemResponseDto } from './order-item-response.dto.js';

export class OrderResponseDto {
  id!: string;
  customerId!: string | null;
  status!: string;
  totalAmount!: number;
  totalCurrency!: string;
  subtotalAmount!: number;
  shippingFeeAmount!: number;
  shippingFeeDiscountAmount!: number;
  netShippingAmount!: number;
  taxAmount!: number;
  shippingAddress!: ShippingAddressProps;
  courierName!: string | null;
  trackingNumber!: string | null;
  notes!: string | null;
  discountCode!: string | null;
  discountType!: string | null;
  discountAmount!: number;
  shippedAt!: string | null;
  deliveredAt!: string | null;
  cancelledAt!: string | null;
  cancellationReason!: string | null;
  items!: OrderItemResponseDto[];
  itemCount!: number;
  createdAt!: string;
  updatedAt!: string;

  static fromPersistence(
    orderRow: OrderSelectRow,
    itemRows: OrderItemSelectRow[],
  ): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = orderRow.id;
    dto.customerId = orderRow.customerId;
    dto.status = orderRow.status;
    dto.totalAmount = orderRow.totalAmount;
    dto.totalCurrency = orderRow.totalCurrency;
    dto.subtotalAmount = orderRow.subtotalAmount ?? 0;
    dto.shippingFeeAmount = orderRow.shippingFeeAmount ?? 0;
    dto.shippingFeeDiscountAmount = orderRow.shippingFeeDiscountAmount ?? 0;
    dto.netShippingAmount = Math.max(
      0,
      dto.shippingFeeAmount - dto.shippingFeeDiscountAmount,
    );
    dto.taxAmount = orderRow.taxAmount ?? 0;
    dto.shippingAddress = {
      recipientName: orderRow.recipientName,
      recipientPhone: orderRow.recipientPhone,
      altPhone: orderRow.altPhone,
      division: orderRow.shippingDivision,
      district: orderRow.shippingDistrict,
      city: orderRow.shippingCity,
      area: orderRow.shippingArea,
      addressLine: orderRow.shippingAddressLine,
      postalCode: orderRow.shippingPostalCode,
      country: orderRow.shippingCountry,
    };
    dto.courierName = orderRow.courierName;
    dto.trackingNumber = orderRow.trackingNumber;
    dto.notes = orderRow.notes;
    dto.discountCode = orderRow.discountCode;
    dto.discountType = orderRow.discountType;
    dto.discountAmount = orderRow.discountAmount ?? 0;
    dto.shippedAt = orderRow.shippedAt
      ? orderRow.shippedAt.toISOString()
      : null;
    dto.deliveredAt = orderRow.deliveredAt
      ? orderRow.deliveredAt.toISOString()
      : null;
    dto.cancelledAt = orderRow.cancelledAt
      ? orderRow.cancelledAt.toISOString()
      : null;
    dto.cancellationReason = orderRow.cancellationReason;
    dto.items = itemRows.map((row) =>
      OrderItemResponseDto.fromPersistence(row),
    );
    dto.itemCount = itemRows.reduce((sum, item) => sum + item.quantity, 0);
    dto.createdAt = orderRow.createdAt.toISOString();
    dto.updatedAt = orderRow.updatedAt.toISOString();
    return dto;
  }

  static fromDomain(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id.getValue();
    dto.customerId = order.customerId;
    dto.status = order.status.getValue();
    dto.totalAmount = order.getTotalAmount().toCents();
    dto.totalCurrency = order.getTotalAmount().getCurrency();
    dto.subtotalAmount = order.getSubtotalAmount().toCents();
    dto.shippingFeeAmount = order.getShippingFeeAmount().toCents();
    dto.shippingFeeDiscountAmount = order
      .getShippingFeeDiscountAmount()
      .toCents();
    dto.netShippingAmount = order.getNetShippingAmount().toCents();
    dto.taxAmount = order.getTaxAmount().toCents();
    dto.shippingAddress = order.shippingAddress.toObject();
    dto.courierName = order.courierName;
    dto.trackingNumber = order.trackingNumber;
    dto.notes = order.notes;
    dto.discountCode = order.discountCode;
    dto.discountType = order.discountType;
    dto.discountAmount = order.discountAmount.toCents();
    dto.shippedAt = order.shippedAt ? order.shippedAt.toISOString() : null;
    dto.deliveredAt = order.deliveredAt
      ? order.deliveredAt.toISOString()
      : null;
    dto.cancelledAt = order.cancelledAt
      ? order.cancelledAt.toISOString()
      : null;
    dto.cancellationReason = order.cancellationReason;
    dto.items = order.items.map((item) =>
      OrderItemResponseDto.fromDomain(item),
    );
    dto.itemCount = order.getItemCount();
    dto.createdAt = order.createdAt.toISOString();
    dto.updatedAt = order.updatedAt.toISOString();
    return dto;
  }
}
