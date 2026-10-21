import { IEvent } from '@nestjs/cqrs';

export class DiscountReleasedEvent implements IEvent {
  constructor(
    public readonly discountId: string,
    public readonly orderId: string,
    public readonly customerIdentifier: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
