export class LoginCustomerCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}
