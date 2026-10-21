export class GetRecentActivityQuery {
  constructor(
    public readonly limit: number = 10,
    public readonly cursor?: string,
    public readonly hasFinancialPermission: boolean = false,
    public readonly hasAuditPermission: boolean = false,
  ) {}
}
