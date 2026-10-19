import type { Request, Response } from 'express';

export interface CookieDurationConfig {
  accessTokenMaxAgeMs: number;
  refreshTokenMaxAgeMs: number;
}

export class AuthCookieHelper {
  static setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    duration: CookieDurationConfig,
    refreshPath: string = '/api/customers',
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Refresh token is restricted to the specific auth path (OWASP best practice)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: refreshPath,
      maxAge: duration.refreshTokenMaxAgeMs,
    });

    // Access token is accessible across the API routes
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: duration.accessTokenMaxAgeMs,
    });
  }

  static clearAuthCookies(
    res: Response,
    refreshPath: string = '/api/customers',
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: refreshPath,
    });
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  static extractCookie(req: Request, cookieName: string): string | undefined {
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader
      .split(';')
      .reduce<Record<string, string>>((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {});

    return cookies[cookieName];
  }
}
