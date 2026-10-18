import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GoogleAuthPort,
  GoogleUserProfile,
} from '../../application/ports/google-auth.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class GoogleAuthAdapter implements GoogleAuthPort {
  private readonly logger = new Logger(GoogleAuthAdapter.name);
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
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3001/api/google/callback',
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

  async exchangeCodeForProfile(code: string): Promise<GoogleUserProfile> {
    try {
      // 1. Exchange authorization code for tokens
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

      // 2. Fetch user profile from Google UserInfo endpoint
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
        email: info.email,
        firstName: info.given_name ?? info.name ?? 'Customer',
        lastName: info.family_name ?? '',
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
}
