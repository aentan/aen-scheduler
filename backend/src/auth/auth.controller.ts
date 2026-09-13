import {
  Controller, Get, Req, Res, UseGuards, Post, Query, UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
// Dedicated package instead of the umbrella `googleapis` (see calendars.service).
import { oauth2 as googleOauth2, auth as googleAuth } from '@googleapis/oauth2';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CalendarsService } from '../calendars/calendars.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private calendarsService: CalendarsService,
    private config: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const { access_token, user } = await this.authService.login(req.user);
    // APP_URL is the admin origin; FRONTEND_URL may be a custom booking
    // domain, which only serves public booking routes — never auth/admin.
    const appUrl = this.config.get('APP_URL') || this.config.get('FRONTEND_URL', 'http://localhost:5173');
    res.redirect(`${appUrl}/auth/callback?token=${access_token}`);
  }

  // Step 1: exchange a JWT for a short-lived connect token
  @Post('google/connect-init')
  @UseGuards(JwtAuthGuard)
  connectInit(@Req() req: any) {
    const token = this.authService.generateConnectToken(req.user.id);
    return { connectToken: token };
  }

  // Step 2: browser redirects here with connect token; we redirect to Google
  @Get('google/connect')
  async googleConnect(@Query('ct') ct: string, @Res() res: any) {
    let payload: any;
    try {
      payload = this.authService.verifyConnectToken(ct);
    } catch {
      throw new UnauthorizedException('Invalid or expired connect token');
    }
    if (payload.mode !== 'connect') throw new UnauthorizedException();

    const state = this.authService.generateConnectToken(payload.userId);
    const connectCallbackUrl = this.config.get('GOOGLE_CONNECT_CALLBACK_URL');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.config.get('GOOGLE_CLIENT_ID'));
    url.searchParams.set('redirect_uri', connectCallbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', [
      'email', 'profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent select_account');
    url.searchParams.set('state', state);

    res.redirect(url.toString());
  }

  // Step 3: Google calls back here with the authorization code
  @Get('google/connect/callback')
  async googleConnectCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    // Redirects target /admin/calendars, which only exists on the admin origin
    const frontendUrl = this.config.get('APP_URL') || this.config.get('FRONTEND_URL', 'http://localhost:5173');

    let payload: any;
    try {
      payload = this.authService.verifyConnectToken(state);
    } catch {
      return res.redirect(`${frontendUrl}/admin/calendars?error=invalid_state`);
    }
    if (payload.mode !== 'connect') {
      return res.redirect(`${frontendUrl}/admin/calendars?error=invalid_state`);
    }

    const connectCallbackUrl = this.config.get('GOOGLE_CONNECT_CALLBACK_URL');
    const oauth2Client = new googleAuth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      connectCallbackUrl,
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = googleOauth2({ version: 'v2', auth: oauth2Client });
      const { data: googleProfile } = await oauth2.userinfo.get();

      await this.authService.connectGoogleAccount(payload.userId, {
        id: googleProfile.id,
        emails: [{ value: googleProfile.email }],
        displayName: googleProfile.name,
        photos: googleProfile.picture ? [{ value: googleProfile.picture }] : [],
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      });

      await this.calendarsService.syncAccountByGoogleId(payload.userId, googleProfile.id);
    } catch (err) {
      console.error('Connect callback error:', err.message);
      return res.redirect(`${frontendUrl}/admin/calendars?error=connect_failed`);
    }

    res.redirect(`${frontendUrl}/admin/calendars?connected=1`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return { success: true };
  }
}
