export const TOKEN_SERVICE_PORT = Symbol('TOKEN_SERVICE_PORT');

export interface TokenPayload {
  sub: string;
  email: string;
  scope: 'customer' | 'admin';
  role?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenServicePort {
  generateTokenPair(payload: TokenPayload): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
  verifyRefreshToken(token: string): Promise<TokenPayload>;
  getAccessTokenMaxAgeMs(): number;
  getRefreshTokenMaxAgeMs(): number;
}
