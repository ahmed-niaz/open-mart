import { ICommand } from '@nestjs/cqrs';

export class DeactivateAdminUserCommand implements ICommand {
  constructor(
    public readonly operatorId: string,
    public readonly targetAdminId: string,
    public readonly reason: string,
  ) {}
}
