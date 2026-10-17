import { CreateProductHandler } from './create-product/create-product.handler.js';
import { DeleteProductHandler } from './delete-product/delete-product.handler.js';
import { UpdateProductHandler } from './update-product/update-product.handler.js';
import { UpdateProductStatusHandler } from './update-product-status/update-product-status.handler.js';

export const ProductCommandHandlers = [
  CreateProductHandler,
  DeleteProductHandler,
  UpdateProductHandler,
  UpdateProductStatusHandler,
];
