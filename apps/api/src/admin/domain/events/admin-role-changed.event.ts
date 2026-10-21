import { IEvent } from '@nestjs/cqrs';

export class AdminRoleChangedEvent implements IEvent {
  constructor(
    public readonly adminId: string,
    public readonly oldRole: string,
    public readonly newRole: string,
    public readonly changedBy: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
