import { PlaceOrderCommandHandler } from './place-order/place-order.handler.js';
import { ConfirmOrderCommandHandler } from './confirm-order/confirm-order.handler.js';
import { ProcessOrderCommandHandler } from './process-order/process-order.handler.js';
import { ShipOrderCommandHandler } from './ship-order/ship-order.handler.js';
import { DeliverOrderCommandHandler } from './deliver-order/deliver-order.handler.js';
import { ReturnOrderCommandHandler } from './return-order/return-order.handler.js';
import { CancelOrderCommandHandler } from './cancel-order/cancel-order.handler.js';

export const OrderCommandHandlers = [
  PlaceOrderCommandHandler,
  ConfirmOrderCommandHandler,
  ProcessOrderCommandHandler,
  ShipOrderCommandHandler,
  DeliverOrderCommandHandler,
  ReturnOrderCommandHandler,
  CancelOrderCommandHandler,
];
