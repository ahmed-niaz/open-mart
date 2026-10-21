import type { OrderItemSelectRow } from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import type { OrderItem } from '../../domain/entities/order-item.entity.js';

export class OrderItemResponseDto {
  id!: string;
  productId!: string;
  productName!: string;
  productSku!: string;
  unitPriceAmount!: number;
  unitPriceCurrency!: string;
  quantity!: number;
  discountAmount!: number;
  totalPriceAmount!: number;
  createdAt!: string;

  static fromPersistence(row: OrderItemSelectRow): OrderItemResponseDto {
    const dto = new OrderItemResponseDto();
    dto.id = row.id;
    dto.productId = row.productId ?? '';
    dto.productName = row.productName;
    dto.productSku = row.productSku;
    dto.unitPriceAmount = row.unitPriceAmount;
    dto.unitPriceCurrency = row.unitPriceCurrency;
    dto.quantity = row.quantity;
    dto.discountAmount = row.discountAmount ?? 0;
    dto.totalPriceAmount =
      row.unitPriceAmount * row.quantity - (row.discountAmount ?? 0);
    dto.createdAt = row.createdAt.toISOString();
    return dto;
  }

  static fromDomain(item: OrderItem): OrderItemResponseDto {
    const dto = new OrderItemResponseDto();
    dto.id = item.id.getValue();
    dto.productId = item.productId;
    dto.productName = item.productName;
    dto.productSku = item.productSku;
    dto.unitPriceAmount = item.unitPrice.toCents();
    dto.unitPriceCurrency = item.unitPrice.getCurrency();
    dto.quantity = item.quantity;
    dto.discountAmount = item.discountAmount.toCents();
    dto.totalPriceAmount = item.getSubtotal().toCents();
    dto.createdAt = new Date().toISOString();
    return dto;
  }
}
