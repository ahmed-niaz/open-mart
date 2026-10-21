export interface VerifiedProductData {
  id: string;
  title: string;
  sku: string;
  unitPriceAmount: number; // in cents
  unitPriceCurrency: string;
  status: string;
  categoryId?: string | null;
}

export const PRODUCT_VERIFICATION_PORT = Symbol('PRODUCT_VERIFICATION_PORT');

export interface ProductVerificationPort {
  getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, VerifiedProductData>>;
}
