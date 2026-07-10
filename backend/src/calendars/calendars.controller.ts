import { Controller, Get, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarsService } from './calendars.service';

@Controller('api/calendars')
@UseGuards(JwtAuthGuard)
export class CalendarsController {
  constructor(private calendarsService: CalendarsService) {}

  @Get()
  listCalendars(@Req() req: any) {
    return this.calendarsService.listCalendars(req.user.id);
  }

  @Get('writable')
  getWritableCalendars(@Req() req: any) {
    return this.calendarsService.getWritableCalendars(req.user.id);
  }

  @Post('sync')
  syncCalendars(@Req() req: any) {
    return this.calendarsService.syncCalendars(req.user.id);
  }

  @Delete(':calendarId')
  disconnectCalendar(@Req() req: any, @Param('calendarId') calendarId: string) {
    return this.calendarsService.disconnectCalendar(req.user.id, calendarId);
  }

  @Get('google-accounts')
  listGoogleAccounts(@Req() req: any) {
    return this.calendarsService.listGoogleAccounts(req.user.id);
  }

  @Delete('google-accounts/:accountId')
  disconnectGoogleAccount(@Req() req: any, @Param('accountId') accountId: string) {
    return this.calendarsService.disconnectGoogleAccount(req.user.id, accountId);
  }
}
