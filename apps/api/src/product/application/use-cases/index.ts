import { CreateProductHandler } from './create-product/create-product.handler.js';

export * from './create-product/create-product.command.js';
export * from './create-product/create-product.handler.js';

export const ProductCommandHandlers = [CreateProductHandler];
