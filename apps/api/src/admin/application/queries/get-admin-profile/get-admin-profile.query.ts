import { IQuery } from '@nestjs/cqrs';

export class GetAdminProfileQuery implements IQuery {
  constructor(public readonly adminId: string) {}
}
