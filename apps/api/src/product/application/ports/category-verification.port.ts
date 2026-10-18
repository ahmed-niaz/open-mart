export const CATEGORY_VERIFICATION_PORT = Symbol('CATEGORY_VERIFICATION_PORT');

export interface CategoryVerificationPort {
  isCategoryValid(categoryId: string): Promise<boolean>;
}
