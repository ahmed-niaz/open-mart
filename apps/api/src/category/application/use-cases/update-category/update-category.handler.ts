import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateCategoryCommand } from './update-category.command.js';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../ports/category.repository.js';
import { CategoryId } from '../../../domain/value-objects/category-id.vo.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(command: UpdateCategoryCommand): Promise<void> {
    const categoryId = new CategoryId(command.id);
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new ApplicationException(
        `Category with id '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    let updatedSlug: Slug | undefined;
    if (command.name !== undefined && command.name.trim() !== category.name) {
      const baseSlug = Slug.create(command.name);
      let candidateSlug = baseSlug;
      let counter = 1;

      while (
        await this.categoryRepository.existsBySlug(candidateSlug, categoryId)
      ) {
        candidateSlug = Slug.create(`${baseSlug.getValue()}-${counter}`);
        counter++;
      }
      updatedSlug = candidateSlug;
    }

    if (command.parentId !== undefined) {
      if (command.parentId === null) {
        category.changeParent(null);
      } else {
        const parentId = new CategoryId(command.parentId);
        const parentExists = await this.categoryRepository.existsById(parentId);
        if (!parentExists) {
          throw new ApplicationException(
            `Parent category with id '${command.parentId}' was not found.`,
            ApplicationExceptionCode.NOT_FOUND,
          );
        }
        category.changeParent(parentId);
      }
    }

    category.updateDetails({
      name: command.name,
      slug: updatedSlug,
      description: command.description,
      imageUrl: command.imageUrl === null ? '' : command.imageUrl,
      displayOrder: command.displayOrder,
    });

    await this.categoryRepository.save(category);
  }
}
