import { ICommand } from '@nestjs/cqrs';

export class CreateAdminUserCommand implements ICommand {
  constructor(
    public readonly operatorId: string,
    public readonly email: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: string,
    public readonly phoneNumber?: string | null,
    public readonly avatarUrl?: string | null,
    public readonly mustChangePassword: boolean = true,
  ) {}
}
