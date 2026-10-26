export class DeleteMediaAssetCommand {
  constructor(
    public readonly id: string,
    public readonly force: boolean = false,
  ) {}
}
