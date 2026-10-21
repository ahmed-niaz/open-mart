import { ICommand } from '@nestjs/cqrs';

export class UpdateAdminUserCommand implements ICommand {
  constructor(
    public readonly operatorId: string,
    public readonly targetAdminId: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phoneNumber?: string | null,
    public readonly avatarUrl?: string | null,
  ) {}
}
