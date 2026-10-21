import { OrderPlacedEvent } from '../../../order/domain/events/order-placed.event.js';
import { OrderConfirmedEvent } from '../../../order/domain/events/order-confirmed.event.js';
import { OrderShippedEvent } from '../../../order/domain/events/order-shipped.event.js';
import { OrderDeliveredEvent } from '../../../order/domain/events/order-delivered.event.js';
import { OrderCancelledEvent } from '../../../order/domain/events/order-cancelled.event.js';
import { OrderReturnedEvent } from '../../../order/domain/events/order-returned.event.js';

import { PaymentInitiatedEvent } from '../../../payment/domain/events/payment-initiated.event.js';
import { PaymentCompletedEvent } from '../../../payment/domain/events/payment-completed.event.js';
import { PaymentFailedEvent } from '../../../payment/domain/events/payment-failed.event.js';
import { PaymentCancelledEvent } from '../../../payment/domain/events/payment-cancelled.event.js';
import { PaymentNeedsReviewEvent } from '../../../payment/domain/events/payment-needs-review.event.js';

import { PaymentCancelledIntegrationEvent } from '../../contracts/events/payment-cancelled.event.js';
import { PaymentCompletedIntegrationEvent } from '../../contracts/events/payment-completed.event.js';
import { PaymentFailedIntegrationEvent } from '../../contracts/events/payment-failed.event.js';

import { StockReservedEvent } from '../../../inventory/domain/events/stock-reserved.event.js';
import { StockCommittedEvent } from '../../../inventory/domain/events/stock-committed.event.js';
import { StockReleasedEvent } from '../../../inventory/domain/events/stock-released.event.js';
import { StockReversedEvent } from '../../../inventory/domain/events/stock-reversed.event.js';
import { StockRestockedEvent } from '../../../inventory/domain/events/stock-restocked.event.js';
import { StockAdjustedEvent } from '../../../inventory/domain/events/stock-adjusted.event.js';
import { LowStockDetectedEvent } from '../../../inventory/domain/events/low-stock-detected.event.js';
import { ReservationExpiredEvent } from '../../../inventory/domain/events/reservation-expired.event.js';

import { DiscountCreatedEvent } from '../../../discount/domain/events/discount-created.event.js';
import { DiscountRedeemedEvent } from '../../../discount/domain/events/discount-redeemed.event.js';
import { DiscountReleasedEvent } from '../../../discount/domain/events/discount-released.event.js';
import { DiscountStatusChangedEvent } from '../../../discount/domain/events/discount-status-changed.event.js';

export const EVENT_REGISTRY: Record<string, new (...args: any[]) => any> = {
  OrderPlacedEvent,
  OrderConfirmedEvent,
  OrderShippedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
  OrderReturnedEvent,

  PaymentInitiatedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentCancelledEvent,
  PaymentNeedsReviewEvent,

  PaymentCancelledIntegrationEvent,
  PaymentCompletedIntegrationEvent,
  PaymentFailedIntegrationEvent,

  StockReservedEvent,
  StockCommittedEvent,
  StockReleasedEvent,
  StockReversedEvent,
  StockRestockedEvent,
  StockAdjustedEvent,
  LowStockDetectedEvent,
  ReservationExpiredEvent,

  DiscountCreatedEvent,
  DiscountRedeemedEvent,
  DiscountReleasedEvent,
  DiscountStatusChangedEvent,
};

export function deserializeOutboxEvent(
  eventType: string,
  payload: any,
  eventId: string,
): any {
  const EventClass = EVENT_REGISTRY[eventType];
  let instance: any;

  if (EventClass) {
    instance = Object.assign(Object.create(EventClass.prototype), payload);
  } else {
    instance = { ...payload, __type: eventType };
  }

  // Attach unique eventId for consumer deduplication
  instance.eventId = eventId;

  // Restore Date objects from serialized ISO strings
  for (const [key, value] of Object.entries(instance)) {
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      instance[key] = new Date(value);
    }
  }

  return instance;
}
