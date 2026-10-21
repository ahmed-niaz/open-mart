import { ICommand } from '@nestjs/cqrs';

export class ChangeAdminRoleCommand implements ICommand {
  constructor(
    public readonly operatorId: string,
    public readonly targetAdminId: string,
    public readonly newRole: string,
  ) {}
}
