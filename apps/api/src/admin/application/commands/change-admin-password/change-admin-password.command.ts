import { ICommand } from '@nestjs/cqrs';

export class ChangeAdminPasswordCommand implements ICommand {
  constructor(
    public readonly adminId: string,
    public readonly newPassword: string,
    public readonly currentPassword?: string,
  ) {}
}
