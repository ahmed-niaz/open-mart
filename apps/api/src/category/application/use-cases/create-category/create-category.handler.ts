import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateCategoryCommand } from './create-category.command.js';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../ports/category.repository.js';
import { Category } from '../../../domain/entities/category.entity.js';
import { CategoryId } from '../../../domain/value-objects/category-id.vo.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<{ id: string }> {
    // Generate unique slug automatically from name
    const baseSlug = Slug.create(command.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.categoryRepository.existsBySlug(slug)) {
      slug = Slug.create(`${baseSlug.getValue()}-${counter}`);
      counter++;
    }

    let parentId: CategoryId | null = null;
    if (command.parentId) {
      parentId = new CategoryId(command.parentId);
      const parentExists = await this.categoryRepository.existsById(parentId);
      if (!parentExists) {
        throw new ApplicationException(
          `Parent category with id '${command.parentId}' was not found.`,
          ApplicationExceptionCode.NOT_FOUND,
        );
      }
    }

    const category = Category.create({
      name: command.name,
      slug,
      description: command.description,
      parentId,
      imageUrl: command.imageUrl,
      displayOrder: command.displayOrder,
      isActive: command.isActive,
    });

    await this.categoryRepository.save(category);

    return { id: category.id.getValue() };
  }
}
