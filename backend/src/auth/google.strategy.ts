import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      accessType: 'offline',
      // Only the *first* authorization needs the consent screen to mint a
      // refresh token; forcing consent on every login churns refresh tokens
      // (toward Google's 50-per-user cap) and can invalidate a working one.
      // Routine logins just pick the account and reuse the stored refresh
      // token; the "connect"/reconnect flow still forces consent when a fresh
      // token is actually required.
      prompt: 'select_account',
      // `accessType`/`prompt` are Google-specific options passport-google-oauth20
      // forwards at runtime but doesn't declare in its TS types; @nestjs/passport
      // v11 tightened the strategy constructor signature, so cast past the gap.
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const tokenExpiry = new Date(Date.now() + 3600 * 1000);
    const user = await this.authService.validateGoogleUser({
      ...profile,
      accessToken,
      refreshToken,
      tokenExpiry,
    });
    done(null, user);
  }
}
