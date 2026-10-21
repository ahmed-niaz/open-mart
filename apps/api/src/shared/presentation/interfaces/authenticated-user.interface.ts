export interface AuthenticatedUser {
  id: string;
  email: string;
  scope?: 'customer' | 'admin';
  role?: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
