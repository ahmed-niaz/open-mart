import { ICommand } from '@nestjs/cqrs';

export class ArchiveProductCommand implements ICommand {
  constructor(public readonly id: string) {}
}
