import { ICommand } from '@nestjs/cqrs';

export class ActivateAdminUserCommand implements ICommand {
  constructor(
    public readonly operatorId: string,
    public readonly targetAdminId: string,
  ) {}
}
