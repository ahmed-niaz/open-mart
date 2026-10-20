export interface ReserveItemInput {
  sku: string;
  quantity: number;
}

export class ReserveStockCommand {
  constructor(
    public readonly orderId: string,
    public readonly items: ReserveItemInput[],
    public readonly ttlMinutes: number = 30,
  ) {}
}
