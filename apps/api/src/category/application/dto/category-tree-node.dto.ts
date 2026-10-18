export class CategoryTreeNodeDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  children: CategoryTreeNodeDto[];
}
