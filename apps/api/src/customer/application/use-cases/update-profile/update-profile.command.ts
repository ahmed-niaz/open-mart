export class UpdateProfileCommand {
  constructor(
    public readonly id: string,
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly phoneNumber?: string | null,
    public readonly avatarUrl?: string | null,
  ) {}
}
