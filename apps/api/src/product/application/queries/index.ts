import { ListProductHandler } from './list-product/list-product.handler.js';
import { GetProductByIdHandler } from './get-product-by-id/get-product-by-id.handler.js';
import { GetProductBySkuHandler } from './get-product-by-sku/get-product-by-sku.handler.js';

export const ProductQueryHandlers = [
  ListProductHandler,
  GetProductByIdHandler,
  GetProductBySkuHandler,
];
