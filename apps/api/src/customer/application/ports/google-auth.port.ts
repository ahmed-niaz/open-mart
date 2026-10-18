export const GOOGLE_AUTH_PORT = Symbol('GOOGLE_AUTH_PORT');

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface GoogleAuthPort {
  getAuthorizationUrl(): string;
  exchangeCodeForProfile(code: string): Promise<GoogleUserProfile>;
}
