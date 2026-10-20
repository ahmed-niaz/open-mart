import { GetOrderByIdQueryHandler } from './get-order-by-id/get-order-by-id.handler.js';
import { ListCustomerOrdersQueryHandler } from './list-customer-orders/list-customer-orders.handler.js';
import { ListOrdersQueryHandler } from './list-orders/list-orders.handler.js';
import { TrackOrderQueryHandler } from './track-order/track-order.handler.js';

export const OrderQueryHandlers = [
  GetOrderByIdQueryHandler,
  ListCustomerOrdersQueryHandler,
  ListOrdersQueryHandler,
  TrackOrderQueryHandler,
];
