import { IEvent } from '@nestjs/cqrs';

export class DiscountRedeemedEvent implements IEvent {
  constructor(
    public readonly discountId: string,
    public readonly orderId: string,
    public readonly customerIdentifier: string,
    public readonly discountAmount: number,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
