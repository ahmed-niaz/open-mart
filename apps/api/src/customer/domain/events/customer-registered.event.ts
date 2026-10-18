export class CustomerRegisteredEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly customerId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly authProvider: 'credentials' | 'google',
  ) {
    this.occurredOn = new Date();
  }
}
