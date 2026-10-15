import { ListProductHandler } from './list-product/list-product.handler.js';
import { GetProductByIdHandler } from './get-product-by-id/get-product-by-id.handler.js';

export * from './list-product/list-product.query.js';
export * from './list-product/list-product.handler.js';
export * from './get-product-by-id/get-product-by-id.query.js';
export * from './get-product-by-id/get-product-by-id.handler.js';

export const ProductQueryHandlers = [ListProductHandler, GetProductByIdHandler];
