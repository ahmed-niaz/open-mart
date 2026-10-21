export class MergeCartCommand {
  constructor(
    public readonly customerId: string,
    public readonly guestId: string,
  ) {}
}
