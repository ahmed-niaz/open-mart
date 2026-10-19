export interface AuthenticatedUser {
  id: string;
  email: string;
  scope?: 'customer' | 'admin';
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
