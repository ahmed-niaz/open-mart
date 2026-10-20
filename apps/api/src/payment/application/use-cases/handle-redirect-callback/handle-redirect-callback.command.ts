export class HandleRedirectCallbackCommand {
  constructor(
    public readonly provider: 'sslcommerz' | 'stripe',
    public readonly payload: Record<string, any>,
  ) {}
}
