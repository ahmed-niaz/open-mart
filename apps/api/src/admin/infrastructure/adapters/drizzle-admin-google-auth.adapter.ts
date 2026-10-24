import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  AdminGoogleAuthPort,
  AdminGoogleUserProfile,
} from '../../application/ports/admin-google-auth.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class AdminGoogleAuthAdapter implements AdminGoogleAuthPort {
  private readonly logger = new Logger(AdminGoogleAuthAdapter.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>(
      'GOOGLE_AUTH_CLIENT_SECRET',
      '',
    );
    this.callbackUrl = this.configService.get<string>(
      'GOOGLE_ADMIN_CALLBACK_URL',
      'http://localhost:3001/api/admin/auth/google/callback',
    );
  }

  getAuthorizationUrl(): string {
    if (!this.clientId) {
      throw new ApplicationException(
        'GOOGLE_AUTH_CLIENT_ID is not configured in environment variables',
        ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }

    const scope = encodeURIComponent('openid email profile');
    const redirectUri = encodeURIComponent(this.callbackUrl);

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  }

  async exchangeCodeForProfile(code: string): Promise<AdminGoogleUserProfile> {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        this.logger.error(`Google token exchange failed: ${errorText}`);
        throw new ApplicationException(
          'Failed to authenticate with Google. Invalid authorization code.',
          ApplicationExceptionCode.UNAUTHORIZED,
        );
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        id_token?: string;
      };

      const userinfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      if (!userinfoResponse.ok) {
        throw new ApplicationException(
          'Failed to retrieve Google user profile',
          ApplicationExceptionCode.UNAUTHORIZED,
        );
      }

      const info = (await userinfoResponse.json()) as {
        sub: string;
        email: string;
        given_name?: string;
        family_name?: string;
        name?: string;
        picture?: string;
      };

      return {
        googleId: info.sub,
        email: info.email.toLowerCase().trim(),
        firstName: info.given_name ?? info.name ?? 'Admin',
        lastName: info.family_name ?? 'User',
        avatarUrl: info.picture ?? null,
      };
    } catch (error) {
      if (error instanceof ApplicationException) throw error;
      this.logger.error(
        `Google OAuth error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new ApplicationException(
        `Google authentication failed: ${(error as Error).message}`,
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }
  }

  async verifyIdToken(idToken: string): Promise<AdminGoogleUserProfile> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
      );

      if (!response.ok) {
        throw new ApplicationException(
          'Invalid Google ID token',
          ApplicationExceptionCode.UNAUTHORIZED,
        );
      }

      const data = (await response.json()) as {
        sub: string;
        email: string;
        given_name?: string;
        family_name?: string;
        name?: string;
        picture?: string;
        aud?: string;
      };

      if (this.clientId && data.aud && data.aud !== this.clientId) {
        throw new ApplicationException(
          'Google token audience mismatch',
          ApplicationExceptionCode.UNAUTHORIZED,
        );
      }

      return {
        googleId: data.sub,
        email: data.email.toLowerCase().trim(),
        firstName: data.given_name ?? data.name ?? 'Admin',
        lastName: data.family_name ?? 'User',
        avatarUrl: data.picture ?? null,
      };
    } catch (error) {
      if (error instanceof ApplicationException) throw error;
      throw new ApplicationException(
        `Google ID token verification failed: ${(error as Error).message}`,
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }
  }
}
