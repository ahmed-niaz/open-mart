import { ICommand } from '@nestjs/cqrs';

export class DeleteProductMediaCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly mediaUrl: string,
  ) {}
}
