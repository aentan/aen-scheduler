import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { google } from 'googleapis';

@Injectable()
export class CalendarsService {
  constructor(private prisma: PrismaService) {}

  private getOAuthClient(accessToken: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    );
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return oauth2Client;
  }

  private async getOAuthClientForCalendar(userId: string, googleCalendarId: string) {
    const cal = await this.prisma.connectedCalendar.findFirst({
      where: { userId, googleCalendarId, isActive: true },
      include: { googleAccount: true },
    });
    if (!cal?.googleAccount) throw new NotFoundException(`No account found for calendar ${googleCalendarId}`);
    return this.getOAuthClient(cal.googleAccount.accessToken, cal.googleAccount.refreshToken);
  }

  async syncCalendars(userId: string) {
    const accounts = await this.prisma.googleAccount.findMany({ where: { userId } });
    if (accounts.length === 0) throw new NotFoundException('No Google accounts connected');
    const results = await Promise.all(accounts.map((a) => this.syncAccount(userId, a)));
    return results.flat();
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
    account: { id: string; accessToken: string; refreshToken: string },
  ) {
    const auth = this.getOAuthClient(account.accessToken, account.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.calendarList.list({ minAccessRole: 'writer' });
    const items = response.data.items || [];

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

        const auth = this.getOAuthClient(account.accessToken, account.refreshToken);
        const calendar = google.calendar({ version: 'v3', auth });

        try {
          const response = await calendar.freebusy.query({
            requestBody: {
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              items: calIds.map((id) => ({ id })),
            },
          });

          for (const [calId, data] of Object.entries(response.data.calendars || {})) {
            allBusy[calId] = (data.busy || []).map((b) => ({ start: b.start, end: b.end }));
          }
        } catch (err) {
          console.error(`FreeBusy error for account ${account.email}:`, err.message);
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
    });
    if (!connected || connected.accessLevel === 'reader') {
      throw new BadRequestException('Cannot write to this calendar');
    }

    const auth = await this.getOAuthClientForCalendar(userId, calendarId);
    const calendar = google.calendar({ version: 'v3', auth });

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

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
      conferenceDataVersion: event.conferenceType === 'google_meet' ? 1 : 0,
      sendUpdates: 'all',
    });

    return response.data;
  }

  async deleteEvent(userId: string, calendarId: string, eventId: string) {
    let auth: any;
    try {
      auth = await this.getOAuthClientForCalendar(userId, calendarId);
    } catch {
      return;
    }
    const calendar = google.calendar({ version: 'v3', auth });
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
