export class CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
