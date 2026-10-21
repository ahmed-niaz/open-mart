import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { INVENTORY_REPOSITORY } from './application/ports/inventory.repository.js';
import { DrizzleInventoryRepository } from './infrastructure/adapters/drizzle-inventory.repository.js';
import { RESERVATION_REPOSITORY } from './application/ports/reservation.repository.js';
import { DrizzleReservationRepository } from './infrastructure/adapters/drizzle-reservation.repository.js';
import { INVENTORY_RESERVATION_PORT } from './application/ports/inventory-reservation.port.js';
import { InventoryReservationAdapter } from './infrastructure/adapters/inventory-reservation.adapter.js';

import { ReserveStockCommandHandler } from './application/commands/reserve-stock/reserve-stock.handler.js';
import { CommitStockCommandHandler } from './application/commands/commit-stock/commit-stock.handler.js';
import { ReleaseStockCommandHandler } from './application/commands/release-stock/release-stock.handler.js';
import { ReverseStockCommandHandler } from './application/commands/reverse-stock/reverse-stock.handler.js';
import { ReturnStockCommandHandler } from './application/commands/return-stock/return-stock.handler.js';
import { RestockCommandHandler } from './application/commands/restock/restock.handler.js';
import { AdjustStockCommandHandler } from './application/commands/adjust-stock/adjust-stock.handler.js';
import { StocktakeCommandHandler } from './application/commands/stocktake/stocktake.handler.js';
import { UpdateSettingsCommandHandler } from './application/commands/update-settings/update-settings.handler.js';

import { GetAvailabilityQueryHandler } from './application/queries/get-availability/get-availability.handler.js';
import { GetInventoryBySkuQueryHandler } from './application/queries/get-inventory-by-sku/get-inventory-by-sku.handler.js';
import { ListInventoryQueryHandler } from './application/queries/list-inventory/list-inventory.handler.js';
import { GetInventoryMovementsQueryHandler } from './application/queries/get-inventory-movements/get-inventory-movements.handler.js';

import { OrderConfirmedInventoryHandler } from './application/event-handlers/order-confirmed.handler.js';
import { OrderCancelledInventoryHandler } from './application/event-handlers/order-cancelled.handler.js';
import { OrderReturnedInventoryHandler } from './application/event-handlers/order-returned.handler.js';
import { LowStockDetectedInventoryHandler } from './application/event-handlers/low-stock-detected.handler.js';

import { ReservationExpiryJob } from './infrastructure/jobs/reservation-expiry.job.js';
import { InventoryReconciliationJob } from './infrastructure/jobs/inventory-reconciliation.job.js';
import { LedgerAuditJob } from './infrastructure/jobs/ledger-audit.job.js';

import { InventoryPublicController } from './presentation/controllers/inventory-public.controller.js';
import { InventoryAdminController } from './presentation/controllers/inventory-admin.controller.js';
import { AdminModule } from '../admin/admin.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [CqrsModule, ConfigModule, AdminModule, NotificationModule],
  controllers: [InventoryPublicController, InventoryAdminController],
  providers: [
    {
      provide: INVENTORY_REPOSITORY,
      useClass: DrizzleInventoryRepository,
    },
    {
      provide: RESERVATION_REPOSITORY,
      useClass: DrizzleReservationRepository,
    },
    {
      provide: INVENTORY_RESERVATION_PORT,
      useClass: InventoryReservationAdapter,
    },
    ReserveStockCommandHandler,
    CommitStockCommandHandler,
    ReleaseStockCommandHandler,
    ReverseStockCommandHandler,
    ReturnStockCommandHandler,
    RestockCommandHandler,
    AdjustStockCommandHandler,
    StocktakeCommandHandler,
    UpdateSettingsCommandHandler,
    GetAvailabilityQueryHandler,
    GetInventoryBySkuQueryHandler,
    ListInventoryQueryHandler,
    GetInventoryMovementsQueryHandler,
    OrderConfirmedInventoryHandler,
    OrderCancelledInventoryHandler,
    OrderReturnedInventoryHandler,
    LowStockDetectedInventoryHandler,
    ReservationExpiryJob,
    InventoryReconciliationJob,
    LedgerAuditJob,
  ],
  exports: [INVENTORY_RESERVATION_PORT, INVENTORY_REPOSITORY],
})
export class InventoryModule {}
