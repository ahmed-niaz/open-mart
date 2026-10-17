import { IQuery } from '@nestjs/cqrs';

export class GetProductBySkuQuery implements IQuery {
  constructor(public readonly sku: string) {}
}
