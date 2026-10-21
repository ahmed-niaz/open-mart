export class ClearCartCommand {
  constructor(
    public readonly customerId?: string | null,
    public readonly guestId?: string | null,
  ) {}
}
