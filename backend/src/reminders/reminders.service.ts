import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { addMinutes } from 'date-fns';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendReminders() {
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: { sendReminders: true },
      select: { id: true, reminderHours: true },
    });

    if (!users.length) return;

    for (const user of users) {
      const windowStart = addMinutes(now, user.reminderHours * 60 - 10);
      const windowEnd = addMinutes(now, user.reminderHours * 60 + 10);

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
