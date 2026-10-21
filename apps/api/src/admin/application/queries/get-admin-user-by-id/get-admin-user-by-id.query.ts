import { IQuery } from '@nestjs/cqrs';

export class GetAdminUserByIdQuery implements IQuery {
  constructor(public readonly adminId: string) {}
}
