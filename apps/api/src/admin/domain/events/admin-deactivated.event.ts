import { IEvent } from '@nestjs/cqrs';

export class AdminDeactivatedEvent implements IEvent {
  constructor(
    public readonly adminId: string,
    public readonly deactivatedBy: string,
    public readonly reason: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
