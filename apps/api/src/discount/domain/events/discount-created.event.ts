import { IEvent } from '@nestjs/cqrs';

export class DiscountCreatedEvent implements IEvent {
  constructor(
    public readonly discountId: string,
    public readonly code: string,
    public readonly type: string,
    public readonly createdBy?: string | null,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
