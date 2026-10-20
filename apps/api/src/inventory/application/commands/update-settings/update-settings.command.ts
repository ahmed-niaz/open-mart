export class UpdateSettingsCommand {
  constructor(
    public readonly sku: string,
    public readonly lowStockThreshold: number,
    public readonly isActive: boolean,
  ) {}
}
