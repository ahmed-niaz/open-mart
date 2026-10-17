import { CreateProductHandler } from './create-product/create-product.handler.js';
import { DeleteProductHandler } from './delete-product/delete-product.handler.js';
import { DeleteProductMediaHandler } from './delete-product-media/delete-product-media.handler.js';
import { UpdateProductHandler } from './update-product/update-product.handler.js';
import { UpdateProductStatusHandler } from './update-product-status/update-product-status.handler.js';
import { ArchiveProductHandler } from './archive-product/archive-product.handler.js';
import { RestoreProductHandler } from './restore-product/restore-product.handler.js';

export const ProductCommandHandlers = [
  CreateProductHandler,
  DeleteProductHandler,
  DeleteProductMediaHandler,
  UpdateProductHandler,
  UpdateProductStatusHandler,
  ArchiveProductHandler,
  RestoreProductHandler,
];
