import { ICommand } from '@nestjs/cqrs';

export class LoginAdminCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ipAddress: string | null = null,
    public readonly userAgent: string | null = null,
  ) {}
}
