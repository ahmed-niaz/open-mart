export const ADMIN_GOOGLE_AUTH_PORT = Symbol('ADMIN_GOOGLE_AUTH_PORT');

export interface AdminGoogleUserProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface AdminGoogleAuthPort {
  getAuthorizationUrl(): string;
  exchangeCodeForProfile(code: string): Promise<AdminGoogleUserProfile>;
  verifyIdToken(idToken: string): Promise<AdminGoogleUserProfile>;
}
