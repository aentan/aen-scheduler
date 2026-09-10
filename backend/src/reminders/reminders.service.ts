import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { addMinutes } from 'date-fns';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  // Half-width of the match window, in minutes. A booking is reminded when its
  // start falls within reminderHours ± this value. It MUST be at least half the
  // interval this job actually runs at, or reminders can slip between runs.
  // When the app is scaled to zero and driven by an external ping (see
  // src/cron), set REMINDER_WINDOW_MINUTES to match that ping's interval.
  private readonly windowMinutes = Number(process.env.REMINDER_WINDOW_MINUTES) || 10;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Also invoked out-of-band via POST /api/internal/cron/reminders so the
  // machine can auto-stop when idle (the in-process @Cron only fires while the
  // machine happens to be running). Idempotent: reminderSentAt guards resends.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendReminders() {
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: { sendReminders: true },
      select: { id: true, reminderHours: true },
    });

    if (!users.length) return;

    for (const user of users) {
      const windowStart = addMinutes(now, user.reminderHours * 60 - this.windowMinutes);
      const windowEnd = addMinutes(now, user.reminderHours * 60 + this.windowMinutes);

      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: user.id,
          status: 'booked',
          reminderSentAt: null,
          startTime: { gte: windowStart, lte: windowEnd },
        },
        include: {
          slotType: true,
          user: { select: { name: true, email: true, timezone: true } },
        },
      });

      for (const booking of bookings) {
        try {
          await this.emailService.sendReminderEmail(booking);
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSentAt: now },
          });
          this.logger.log(`Reminder sent for booking ${booking.id}`);
        } catch (err) {
          this.logger.error(`Failed to send reminder for booking ${booking.id}: ${err.message}`);
        }
      }
    }
  }
}
