import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteCategoryCommand } from './delete-category.command.js';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../ports/category.repository.js';
import { CategoryId } from '../../../domain/value-objects/category-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<
  DeleteCategoryCommand,
  void
> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(command: DeleteCategoryCommand): Promise<void> {
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
        'Cannot delete category because it has subcategories. Please reassign or delete subcategories first.',
        ApplicationExceptionCode.CONFLICT,
      );
    }

    await this.categoryRepository.delete(categoryId);
  }
}
