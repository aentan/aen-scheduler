import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
// Dedicated API packages instead of the umbrella `googleapis` — the umbrella
// eagerly loads metadata for every Google API (~10x slower to require), which
// hurts scale-to-zero cold starts.
import { calendar as googleCalendar, auth as googleAuth } from '@googleapis/calendar';

@Injectable()
export class CalendarsService {
  private readonly logger = new Logger(CalendarsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private getOAuthClient(account: {
    id: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Date;
  }) {
    const oauth2Client = new googleAuth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    );
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken || undefined,
      expiry_date: account.tokenExpiry?.getTime(),
    });
    // Persist refreshed tokens so we don't depend on the user re-logging in.
    // A successful refresh also means the account is healthy again, so clear
    // any stale re-auth flag.
    oauth2Client.on('tokens', (tokens) => {
      if (!tokens.access_token) return;
      this.prisma.googleAccount
        .update({
          where: { id: account.id },
          data: {
            accessToken: tokens.access_token,
            tokenExpiry: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
            needsReauth: false,
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          },
        })
        .catch((err) => console.error('Failed to persist refreshed Google tokens:', err.message));
    });
    return oauth2Client;
  }

  /**
   * A failed OAuth *refresh* (revoked/expired refresh token, e.g. Google's
   * `invalid_grant`) is unrecoverable without the owner re-consenting. Detect
   * it so we can flag the account instead of silently failing every call.
   */
  private isAuthError(err: any): boolean {
    const code = err?.response?.data?.error || err?.code;
    return (
      code === 'invalid_grant' ||
      code === 'unauthorized_client' ||
      code === 'invalid_client' ||
      err?.response?.status === 401 ||
      /invalid_grant/.test(err?.message || '')
    );
  }

  private async flagReauth(accountId: string) {
    await this.prisma.googleAccount
      .update({ where: { id: accountId }, data: { needsReauth: true } })
      .catch((err) => console.error('Failed to flag account for re-auth:', err.message));
  }

  /**
   * Keep every Google connection warm. Refreshing on a schedule (rather than
   * lazily at booking time) means a token is always fresh before it's needed,
   * exercises the credential so it never lapses from inactivity, and surfaces a
   * revoked/expired grant as an email alert instead of a failed booking.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshTokens() {
    const accounts = await this.prisma.googleAccount.findMany({
      include: { user: { select: { email: true } } },
    });
    for (const account of accounts) {
      await this.refreshAndCheck(account);
    }
  }

  private async refreshAndCheck(account: {
    id: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Date;
    needsReauth: boolean;
    user: { email: string };
  }) {
    if (!account.refreshToken) {
      await this.markUnhealthy(account, 'no refresh token stored');
      return;
    }

    const auth = this.getOAuthClient(account);
    // Drop the cached access token so getAccessToken() always performs a real
    // refresh — that's what proves the refresh token is still valid. On success
    // the 'tokens' listener persists the new token and clears needsReauth.
    auth.setCredentials({ refresh_token: account.refreshToken });

    try {
      await auth.getAccessToken();
      if (account.needsReauth) {
        await this.prisma.googleAccount
          .update({ where: { id: account.id }, data: { needsReauth: false } })
          .catch(() => {});
        this.logger.log(`Re-auth cleared for ${account.email} (token refreshed).`);
      }
    } catch (err) {
      // Transient/network errors: leave state untouched and retry next run.
      if (this.isAuthError(err)) {
        await this.markUnhealthy(account, err.message);
      } else {
        this.logger.warn(`Token refresh error for ${account.email} (will retry): ${err.message}`);
      }
    }
  }

  private async markUnhealthy(
    account: { id: string; email: string; needsReauth: boolean; user: { email: string } },
    reason: string,
  ) {
    const wasHealthy = !account.needsReauth;
    await this.flagReauth(account.id);
    if (wasHealthy) {
      this.logger.warn(`Flagged ${account.email} for re-auth: ${reason}`);
      await this.emailService
        .sendReconnectNeeded(account.user.email, { email: account.email })
        .catch((e) => this.logger.error(`Reconnect alert email failed: ${e.message}`));
    }
  }

  private async getOAuthClientForCalendar(userId: string, googleCalendarId: string) {
    const cal = await this.prisma.connectedCalendar.findFirst({
      where: { userId, googleCalendarId, isActive: true },
      include: { googleAccount: true },
    });
    if (!cal?.googleAccount) throw new NotFoundException(`No account found for calendar ${googleCalendarId}`);
    return this.getOAuthClient(cal.googleAccount);
  }

  async syncCalendars(userId: string) {
    const accounts = await this.prisma.googleAccount.findMany({ where: { userId } });
    if (accounts.length === 0) throw new NotFoundException('No Google accounts connected');
    // One broken account (e.g. revoked refresh token) shouldn't stop the others
    // from syncing; syncAccount flags such accounts for re-auth.
    const settled = await Promise.allSettled(accounts.map((a) => this.syncAccount(userId, a)));
    return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  }

  async syncAccountByGoogleId(userId: string, googleId: string) {
    const account = await this.prisma.googleAccount.findUnique({
      where: { userId_googleId: { userId, googleId } },
    });
    if (!account) throw new NotFoundException('Google account not found');
    return this.syncAccount(userId, account);
  }

  private async syncAccount(
    userId: string,
    account: { id: string; accessToken: string; refreshToken: string; tokenExpiry: Date },
  ) {
    const auth = this.getOAuthClient(account);
    const calendar = googleCalendar({ version: 'v3', auth });

    let items: any[];
    try {
      const response = await calendar.calendarList.list({ minAccessRole: 'writer' });
      items = response.data.items || [];
    } catch (err) {
      if (this.isAuthError(err)) await this.flagReauth(account.id);
      throw err;
    }

    const results = await Promise.all(
      items.map(async (cal) => {
        const accessLevel = this.mapAccessRole(cal.accessRole);
        return this.prisma.connectedCalendar.upsert({
          where: { userId_googleCalendarId: { userId, googleCalendarId: cal.id } },
          update: {
            name: cal.summary || cal.id,
            description: cal.description,
            accessLevel,
            backgroundColor: cal.backgroundColor,
            isActive: true,
            googleAccountId: account.id,
          },
          create: {
            userId,
            googleAccountId: account.id,
            googleCalendarId: cal.id,
            name: cal.summary || cal.id,
            description: cal.description,
            accessLevel,
            backgroundColor: cal.backgroundColor,
          },
        });
      }),
    );

    const googleIds = items.map((c) => c.id);
    await this.prisma.connectedCalendar.updateMany({
      where: { userId, googleAccountId: account.id, googleCalendarId: { notIn: googleIds } },
      data: { isActive: false },
    });

    return results;
  }

  private mapAccessRole(role: string): string {
    if (role === 'owner' || role === 'writer') return role;
    return 'reader';
  }

  async listCalendars(userId: string) {
    return this.prisma.connectedCalendar.findMany({
      where: { userId, isActive: true },
      include: {
        googleAccount: { select: { id: true, email: true, name: true, picture: true, isPrimary: true } },
      },
      orderBy: [{ accessLevel: 'asc' }, { name: 'asc' }],
    });
  }

  async getWritableCalendars(userId: string) {
    return this.prisma.connectedCalendar.findMany({
      where: { userId, isActive: true, accessLevel: { in: ['writer', 'owner'] } },
    });
  }

  async listGoogleAccounts(userId: string) {
    return this.prisma.googleAccount.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        isPrimary: true,
        needsReauth: true,
        createdAt: true,
        connectedCalendars: { where: { isActive: true }, select: { id: true, name: true } },
      },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async disconnectGoogleAccount(userId: string, accountId: string) {
    const account = await this.prisma.googleAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Google account not found');
    if (account.isPrimary) throw new BadRequestException('Cannot disconnect your primary account');

    await this.prisma.connectedCalendar.updateMany({
      where: { userId, googleAccountId: accountId },
      data: { isActive: false },
    });

    return this.prisma.googleAccount.delete({ where: { id: accountId } });
  }

  async getFreeBusy(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<Record<string, { start: string; end: string }[]>> {
    const accounts = await this.prisma.googleAccount.findMany({
      where: { userId },
      include: { connectedCalendars: { where: { isActive: true } } },
    });

    const allBusy: Record<string, { start: string; end: string }[]> = {};

    await Promise.all(
      accounts.map(async (account) => {
        const calIds = account.connectedCalendars.map((c) => c.googleCalendarId);
        if (calIds.length === 0) return;

        const auth = this.getOAuthClient(account);
        const calendar = googleCalendar({ version: 'v3', auth });

        // Fail closed: if we can't confirm a calendar is free, treat the whole
        // window as busy so a broken credential can't cause a double-booking.
        const blockWholeWindow = { start: timeMin.toISOString(), end: timeMax.toISOString() };

        try {
          const response = await calendar.freebusy.query({
            requestBody: {
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              items: calIds.map((id) => ({ id })),
            },
          });

          for (const [calId, data] of Object.entries(response.data.calendars || {})) {
            // Google can report per-calendar errors while the overall request
            // succeeds (access lost, calendar gone). Block those too.
            allBusy[calId] =
              data.errors && data.errors.length > 0
                ? [blockWholeWindow]
                : (data.busy || []).map((b) => ({ start: b.start, end: b.end }));
          }
        } catch (err) {
          console.error(`FreeBusy error for account ${account.email}:`, err.message);
          if (this.isAuthError(err)) await this.flagReauth(account.id);
          for (const id of calIds) allBusy[id] = [blockWholeWindow];
        }
      }),
    );

    return allBusy;
  }

  async createEvent(
    userId: string,
    calendarId: string,
    event: {
      summary: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      attendeeEmail: string;
      attendeeName: string;
      conferenceType?: string;
    },
  ) {
    const connected = await this.prisma.connectedCalendar.findFirst({
      where: { userId, googleCalendarId: calendarId, isActive: true },
      include: { googleAccount: true },
    });
    if (!connected || connected.accessLevel === 'reader') {
      throw new BadRequestException('Cannot write to this calendar');
    }
    if (!connected.googleAccount) {
      throw new NotFoundException(`No account found for calendar ${calendarId}`);
    }

    const auth = this.getOAuthClient(connected.googleAccount);
    const calendar = googleCalendar({ version: 'v3', auth });

    const eventBody: any = {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
      attendees: [{ email: event.attendeeEmail, displayName: event.attendeeName }],
    };

    if (event.conferenceType === 'google_meet') {
      eventBody.conferenceData = {
        createRequest: { requestId: `${userId}-${Date.now()}` },
      };
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
        conferenceDataVersion: event.conferenceType === 'google_meet' ? 1 : 0,
        sendUpdates: 'all',
      });

      return response.data;
    } catch (err) {
      if (this.isAuthError(err)) await this.flagReauth(connected.googleAccountId);
      throw err;
    }
  }

  async deleteEvent(userId: string, calendarId: string, eventId: string) {
    let auth: any;
    try {
      auth = await this.getOAuthClientForCalendar(userId, calendarId);
    } catch {
      return;
    }
    const calendar = googleCalendar({ version: 'v3', auth });
    try {
      await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' });
    } catch (err) {
      console.error('Delete event error:', err.message);
    }
  }

  async disconnectCalendar(userId: string, calendarId: string) {
    return this.prisma.connectedCalendar.updateMany({
      where: { userId, googleCalendarId: calendarId },
      data: { isActive: false },
    });
  }
}
