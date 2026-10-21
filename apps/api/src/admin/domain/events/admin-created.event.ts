import { IEvent } from '@nestjs/cqrs';

export class AdminCreatedEvent implements IEvent {
  constructor(
    public readonly adminId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly createdBy: string | null,
    public readonly mustChangePassword: boolean,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
