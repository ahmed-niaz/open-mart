import { CreateProductHandler } from './create-product/create-product.handler.js';
import { DeleteProductHandler } from './delete-product/delete-product.handler.js';

export const ProductCommandHandlers = [
  CreateProductHandler,
  DeleteProductHandler,
];
