export class LoginAdminGoogleCommand {
  constructor(
    public readonly code?: string,
    public readonly idToken?: string,
    public readonly ipAddress?: string | null,
    public readonly userAgent?: string | null,
  ) {}
}
