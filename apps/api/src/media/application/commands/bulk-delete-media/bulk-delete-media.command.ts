export class BulkDeleteMediaCommand {
  constructor(
    public readonly ids: string[],
    public readonly force: boolean = false,
  ) {}
}
