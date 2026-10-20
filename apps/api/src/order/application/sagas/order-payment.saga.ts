import { Injectable, Logger } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { PaymentCompletedIntegrationEvent } from '../../../shared/contracts/events/payment-completed.event.js';
import { ConfirmOrderCommand } from '../use-cases/confirm-order/confirm-order.command.js';

@Injectable()
export class OrderPaymentSaga {
  private readonly logger = new Logger(OrderPaymentSaga.name);

  @Saga()
  paymentCompleted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(PaymentCompletedIntegrationEvent),
      map((event) => {
        this.logger.log(
          `OrderPaymentSaga: Received PaymentCompletedIntegrationEvent for Order ${event.orderId} (Txn: ${event.transactionId}, Provider: ${event.provider}). Triggering ConfirmOrderCommand...`,
        );
        return new ConfirmOrderCommand(event.orderId);
      }),
    );
  };
}
