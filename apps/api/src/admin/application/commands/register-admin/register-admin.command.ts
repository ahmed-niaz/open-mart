export class RegisterAdminCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phoneNumber?: string,
    public readonly registrationSecret?: string,
    public readonly ipAddress?: string | null,
    public readonly userAgent?: string | null,
  ) {}
}
