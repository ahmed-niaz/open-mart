import { RegisterCustomerHandler } from './register-customer/register-customer.handler.js';
import { GoogleAuthHandler } from './google-auth/google-auth.handler.js';
import { LoginCustomerHandler } from './login-customer/login-customer.handler.js';
import { UpdateProfileHandler } from './update-profile/update-profile.handler.js';
import { DeactivateCustomerHandler } from './deactivate-customer/deactivate-customer.handler.js';
import { ActivateCustomerHandler } from './activate-customer/activate-customer.handler.js';
import { RefreshTokenHandler } from './refresh-token/refresh-token.handler.js';

export {
  RegisterCustomerHandler,
  GoogleAuthHandler,
  LoginCustomerHandler,
  UpdateProfileHandler,
  DeactivateCustomerHandler,
  ActivateCustomerHandler,
  RefreshTokenHandler,
};

export const CustomerCommandHandlers = [
  RegisterCustomerHandler,
  GoogleAuthHandler,
  LoginCustomerHandler,
  UpdateProfileHandler,
  DeactivateCustomerHandler,
  ActivateCustomerHandler,
  RefreshTokenHandler,
];
