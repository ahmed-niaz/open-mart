import { IQuery } from '@nestjs/cqrs';

export class ListAdminAuditLogsQuery implements IQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly adminId?: string,
    public readonly action?: string,
  ) {}
}
