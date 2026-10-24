import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { count, desc, eq, max, sql } from 'drizzle-orm';

import { GetAdminCustomerDetailsQuery } from './get-admin-customer-details.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import {
  ordersSchema,
  orderItemsSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type {
  AdminCustomerAddressDto,
  AdminCustomerDetailsDto,
  AdminCustomerOrderSummaryDto,
} from '../../dto/admin-customer-details.dto.js';

@QueryHandler(GetAdminCustomerDetailsQuery)
export class GetAdminCustomerDetailsHandler implements IQueryHandler<
  GetAdminCustomerDetailsQuery,
  AdminCustomerDetailsDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: GetAdminCustomerDetailsQuery,
  ): Promise<AdminCustomerDetailsDto> {
    // 1. Fetch customer base row
    const [customer] = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.id, query.customerId))
      .limit(1);

    if (!customer) {
      throw new ApplicationException(
        `Customer with id '${query.customerId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // 2. Fetch customer aggregated order stats
    const [orderStats] = await this.db
      .select({
        totalOrders: count(ordersSchema.id),
        totalSpentCents: sql<number>`coalesce(sum(case when ${ordersSchema.status} != 'cancelled' then ${ordersSchema.totalAmount} else 0 end), 0)::int`,
        completedOrders: sql<number>`count(case when ${ordersSchema.status} = 'delivered' then 1 end)::int`,
        cancelledOrders: sql<number>`count(case when ${ordersSchema.status} = 'cancelled' then 1 end)::int`,
        lastOrderAt: max(ordersSchema.createdAt),
      })
      .from(ordersSchema)
      .where(eq(ordersSchema.customerId, query.customerId));

    const totalOrders = Number(orderStats?.totalOrders ?? 0);
    const totalSpentCents = Number(orderStats?.totalSpentCents ?? 0);
    const completedOrders = Number(orderStats?.completedOrders ?? 0);
    const cancelledOrders = Number(orderStats?.cancelledOrders ?? 0);
    const averageOrderValueBDT =
      totalOrders > 0 ? Math.round(totalSpentCents / 100 / totalOrders) : 0;

    // 3. Fetch recent 10 orders for this customer
    const rawOrders = await this.db
      .select({
        id: ordersSchema.id,
        status: ordersSchema.status,
        totalAmount: ordersSchema.totalAmount,
        totalCurrency: ordersSchema.totalCurrency,
        createdAt: ordersSchema.createdAt,
        itemsCount: sql<number>`(select coalesce(sum(${orderItemsSchema.quantity}), count(*)) from ${orderItemsSchema} where ${orderItemsSchema.orderId} = ${ordersSchema.id})::int`,
      })
      .from(ordersSchema)
      .where(eq(ordersSchema.customerId, query.customerId))
      .orderBy(desc(ordersSchema.createdAt))
      .limit(10);

    const recentOrders: AdminCustomerOrderSummaryDto[] = rawOrders.map(
      (ord) => ({
        id: ord.id,
        status: ord.status,
        totalAmount: ord.totalAmount,
        totalAmountBDT: Math.round(ord.totalAmount / 100),
        totalCurrency: ord.totalCurrency,
        itemsCount: Number(ord.itemsCount ?? 0),
        createdAt: ord.createdAt.toISOString(),
      }),
    );

    // 4. Extract unique shipping addresses from customer's order history
    const addressOrders = await this.db
      .select({
        recipientName: ordersSchema.recipientName,
        recipientPhone: ordersSchema.recipientPhone,
        altPhone: ordersSchema.altPhone,
        shippingDivision: ordersSchema.shippingDivision,
        shippingDistrict: ordersSchema.shippingDistrict,
        shippingCity: ordersSchema.shippingCity,
        shippingArea: ordersSchema.shippingArea,
        shippingAddressLine: ordersSchema.shippingAddressLine,
        shippingPostalCode: ordersSchema.shippingPostalCode,
        shippingCountry: ordersSchema.shippingCountry,
        createdAt: ordersSchema.createdAt,
      })
      .from(ordersSchema)
      .where(eq(ordersSchema.customerId, query.customerId))
      .orderBy(desc(ordersSchema.createdAt));

    const seenAddressKeys = new Set<string>();
    const addresses: AdminCustomerAddressDto[] = [];

    for (const ord of addressOrders) {
      const key = `${(ord.shippingAddressLine || '').trim().toLowerCase()}_${(ord.shippingArea || '').trim().toLowerCase()}_${(ord.shippingCity || '').trim().toLowerCase()}`;
      if (!seenAddressKeys.has(key) && ord.shippingAddressLine) {
        seenAddressKeys.add(key);
        addresses.push({
          recipientName: ord.recipientName,
          recipientPhone: ord.recipientPhone,
          altPhone: ord.altPhone || null,
          division: ord.shippingDivision,
          district: ord.shippingDistrict,
          city: ord.shippingCity,
          area: ord.shippingArea,
          addressLine: ord.shippingAddressLine,
          postalCode: ord.shippingPostalCode || null,
          country: ord.shippingCountry || 'BD',
          lastUsedAt: ord.createdAt.toISOString(),
        });
      }
    }

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      phoneNumber: customer.phoneNumber,
      avatarUrl: customer.avatarUrl,
      isActive: customer.isActive,
      isEmailVerified: customer.isEmailVerified,
      isGoogleLinked: Boolean(customer.googleId),
      version: customer.version,
      lastLoginAt: customer.lastLoginAt
        ? customer.lastLoginAt.toISOString()
        : null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      stats: {
        totalOrders,
        totalSpentCents,
        totalSpentBDT: Math.round(totalSpentCents / 100),
        currency: 'BDT',
        completedOrders,
        cancelledOrders,
        averageOrderValueBDT,
        lastOrderAt: orderStats?.lastOrderAt
          ? new Date(orderStats.lastOrderAt).toISOString()
          : null,
      },
      addresses,
      recentOrders,
    };
  }
}
