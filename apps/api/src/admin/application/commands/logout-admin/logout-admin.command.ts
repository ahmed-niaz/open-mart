export class LogoutAdminCommand {
  constructor(public readonly refreshToken: string | null) {}
}
