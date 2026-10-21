import { ICommand } from '@nestjs/cqrs';

export class RefreshAdminTokenCommand implements ICommand {
  constructor(public readonly refreshToken: string) {}
}
