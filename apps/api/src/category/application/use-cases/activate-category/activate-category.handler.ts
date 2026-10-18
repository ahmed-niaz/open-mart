import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ActivateCategoryCommand } from './activate-category.command.js';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../ports/category.repository.js';
import { CategoryId } from '../../../domain/value-objects/category-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(ActivateCategoryCommand)
export class ActivateCategoryHandler implements ICommandHandler<ActivateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(command: ActivateCategoryCommand): Promise<void> {
    const categoryId = new CategoryId(command.id);
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new ApplicationException(
        `Category with id '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    category.activate();
    await this.categoryRepository.save(category);
  }
}
