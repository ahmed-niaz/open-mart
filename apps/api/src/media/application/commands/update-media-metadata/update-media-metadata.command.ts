export class UpdateMediaMetadataCommand {
  constructor(
    public readonly id: string,
    public readonly altText?: string,
    public readonly originalName?: string,
  ) {}
}
