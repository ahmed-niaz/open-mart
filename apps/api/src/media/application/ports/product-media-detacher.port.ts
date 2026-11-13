export const PRODUCT_MEDIA_DETACHER_PORT = Symbol(
  'PRODUCT_MEDIA_DETACHER_PORT',
);

export interface ProductMediaDetacherPort {
  /**
   * Detaches media URLs from all products' gallery media arrays and variant imageUrls,
   * updates the products table, and invalidates affected Redis cache keys so the image
   * is immediately unavailable everywhere.
   */
  detachMediaUrlsFromAllProducts(mediaUrls: string[]): Promise<number>;
}
