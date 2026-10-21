import { IEvent } from '@nestjs/cqrs';

export class DiscountStatusChangedEvent implements IEvent {
  constructor(
    public readonly discountId: string,
    public readonly code: string,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly updatedBy?: string | null,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
