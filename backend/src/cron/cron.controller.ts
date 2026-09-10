import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';
import { RemindersService } from '../reminders/reminders.service';
import { CalendarsService } from '../calendars/calendars.service';

/**
 * Out-of-band triggers for the scheduled jobs. These let the app machine
 * auto-stop when idle (min_machines_running=0): an external scheduler pings
 * these endpoints, which wakes the machine, runs the job, and lets it sleep
 * again. The in-process @Cron jobs still run whenever the machine is awake, so
 * this is additive — both paths are idempotent.
 */
@Controller('api/internal/cron')
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly calendars: CalendarsService,
  ) {}

  @Post('reminders')
  @HttpCode(200)
  async runReminders() {
    await this.reminders.sendReminders();
    return { ok: true };
  }

  @Post('refresh-tokens')
  @HttpCode(200)
  async runRefreshTokens() {
    await this.calendars.refreshTokens();
    return { ok: true };
  }
}
