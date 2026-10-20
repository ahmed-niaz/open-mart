export class ShipOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly courierName?: string | null,
  ) {}
}
