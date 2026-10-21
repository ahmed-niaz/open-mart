export interface ProductSummary {
  id: string;
  title: string;
  sku: string;
  priceCents: number;
  currency: string;
  isPublished: boolean;
  thumbnailUrl: string | null;
}

export const CART_PRODUCT_PORT = Symbol('CART_PRODUCT_PORT');

export interface CartProductPort {
  getProduct(productId: string): Promise<ProductSummary | null>;
  getProducts(productIds: string[]): Promise<Map<string, ProductSummary>>;
}
