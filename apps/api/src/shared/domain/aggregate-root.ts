import { AggregateRoot as CQRSAggregateRoot } from '@nestjs/cqrs';

export abstract class AggregateRoot extends CQRSAggregateRoot {
  /**
   * Clears all uncommitted domain events staged on this aggregate.
   */
  clearEvents(): void {
    this.uncommit();
  }
}
