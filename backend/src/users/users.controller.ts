import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('timezone')
  updateTimezone(@Req() req: any, @Body() body: { timezone: string }) {
    return this.usersService.updateTimezone(req.user.id, body.timezone);
  }

  @Put('primary-calendar')
  updatePrimaryCalendar(@Req() req: any, @Body() body: { calendarId: string }) {
    return this.usersService.updatePrimaryCalendar(req.user.id, body.calendarId);
  }

  @Put('slug')
  updateSlug(@Req() req: any, @Body() body: { slug: string }) {
    return this.usersService.updateSlug(req.user.id, body.slug);
  }

  @Put('custom-domain')
  updateCustomDomain(@Req() req: any, @Body() body: { domain: string | null }) {
    return this.usersService.updateCustomDomain(req.user.id, body.domain);
  }

  @Put('email-prefs')
  updateEmailPrefs(
    @Req() req: any,
    @Body() body: { notifyOnBooking?: boolean; sendReminders?: boolean; reminderHours?: number },
  ) {
    return this.usersService.updateEmailPrefs(req.user.id, body);
  }

  @Put('theme-prefs')
  updateThemePrefs(
    @Req() req: any,
    @Body() body: { theme?: string; applyThemeToAdmin?: boolean; applyThemeToBooking?: boolean },
  ) {
    return this.usersService.updateThemePrefs(req.user.id, body);
  }
}
