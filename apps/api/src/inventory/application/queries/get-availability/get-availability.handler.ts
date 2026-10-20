import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetAvailabilityQuery } from './get-availability.query.js';
import {
  INVENTORY_RESERVATION_PORT,
  type InventoryReservationPort,
  type AvailabilityStatus,
} from '../../ports/inventory-reservation.port.js';

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityQueryHandler implements IQueryHandler<
  GetAvailabilityQuery,
  Record<string, AvailabilityStatus>
> {
  constructor(
    @Inject(INVENTORY_RESERVATION_PORT)
    private readonly reservationPort: InventoryReservationPort,
  ) {}

  async execute(
    query: GetAvailabilityQuery,
  ): Promise<Record<string, AvailabilityStatus>> {
    const availabilityMap = await this.reservationPort.checkAvailability(
      query.skus,
    );

    const result: Record<string, AvailabilityStatus> = {};
    for (const [sku, status] of availabilityMap.entries()) {
      result[sku] = status;
    }

    return result;
  }
}
