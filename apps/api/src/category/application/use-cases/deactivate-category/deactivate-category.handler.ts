import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeactivateCategoryCommand } from './deactivate-category.command.js';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../ports/category.repository.js';
import { CategoryId } from '../../../domain/value-objects/category-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeactivateCategoryCommand)
export class DeactivateCategoryHandler implements ICommandHandler<DeactivateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(command: DeactivateCategoryCommand): Promise<void> {
    const categoryId = new CategoryId(command.id);
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new ApplicationException(
        `Category with id '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const hasChildren = await this.categoryRepository.hasChildren(categoryId);
    if (hasChildren) {
      throw new ApplicationException(
        `Cannot deactivate category '${category.name}' because it contains subcategories. Reassign or deactivate child categories first.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    category.deactivate();
    await this.categoryRepository.save(category);
  }
}
