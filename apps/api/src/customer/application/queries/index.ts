import { GetCustomerByIdHandler } from './get-customer-by-id/get-customer-by-id.handler.js';
import { GetCustomerByEmailHandler } from './get-customer-by-email/get-customer-by-email.handler.js';
import { ListCustomersHandler } from './list-customers/list-customers.handler.js';
import { ListAdminCustomersHandler } from './list-admin-customers/list-admin-customers.handler.js';
import { GetAdminCustomerDetailsHandler } from './get-admin-customer-details/get-admin-customer-details.handler.js';

export {
  GetCustomerByIdHandler,
  GetCustomerByEmailHandler,
  ListCustomersHandler,
  ListAdminCustomersHandler,
  GetAdminCustomerDetailsHandler,
};

export const CustomerQueryHandlers = [
  GetCustomerByIdHandler,
  GetCustomerByEmailHandler,
  ListCustomersHandler,
  ListAdminCustomersHandler,
  GetAdminCustomerDetailsHandler,
];
