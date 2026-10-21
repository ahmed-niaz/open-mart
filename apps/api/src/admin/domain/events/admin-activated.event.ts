import { IEvent } from '@nestjs/cqrs';

export class AdminActivatedEvent implements IEvent {
  constructor(
    public readonly adminId: string,
    public readonly activatedBy: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
