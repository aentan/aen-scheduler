import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && !apiKey.startsWith('your_')) {
      this.resend = new Resend(apiKey);
    }
    const fromEmail = process.env.EMAIL_FROM || 'noreply@example.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'Scheduler';
    this.from = `${fromName} <${fromEmail}>`;
  }

  private formatTime(date: Date, tz: string) {
    return format(toZonedTime(date, tz), "EEEE, MMMM d yyyy 'at' h:mm a zzz");
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.log(`[Email skip] ${subject} → ${to}`);
      return;
    }
    await this.resend.emails.send({ from: this.from, to, subject, html });
  }

  async sendBookingConfirmation(booking: any, opts?: { notifyOrganizer?: boolean }) {
    const notifyOrganizer = opts?.notifyOrganizer ?? true;
    const attendeeTime = this.formatTime(booking.startTime, booking.attendeeTimezone);
    const organizerTime = this.formatTime(booking.startTime, booking.user.timezone);
    const baseUrl = process.env.FRONTEND_URL ?? '';

    const sends: Promise<any>[] = [
      this.send(
        booking.attendeeEmail,
        `Meeting Confirmed: ${booking.slotType.name} — ${attendeeTime}`,
        `<h2>Meeting Confirmed: ${booking.slotType.name}</h2>
<p>Hi ${booking.attendeeName},</p>
<p>Your meeting has been confirmed.</p>
<p><strong>When:</strong> ${attendeeTime}</p>
${booking.meetingLink ? `<p><strong>Join:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
<p><strong>With:</strong> ${booking.user.name}</p>
<hr>
<p>
  <a href="${baseUrl}/cancel/${booking.cancelToken}">Cancel this booking</a> &nbsp;|&nbsp;
  <a href="${baseUrl}/reschedule/${booking.rescheduleToken}">Reschedule</a>
</p>`,
      ),
    ];

    if (notifyOrganizer) {
      sends.push(
        this.send(
          booking.user.email,
          `New booking from ${booking.attendeeName}`,
          `<h2>New Booking: ${booking.slotType.name}</h2>
<p>New meeting booked by ${booking.attendeeName} (<a href="mailto:${booking.attendeeEmail}">${booking.attendeeEmail}</a>).</p>
<p><strong>When:</strong> ${organizerTime}</p>
${booking.attendeeMessage ? `<p><strong>Message:</strong> ${booking.attendeeMessage}</p>` : ''}
${booking.meetingLink ? `<p><strong>Join:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}`,
        ),
      );
    }

    await Promise.all(sends);
  }

  async sendCalendarSyncFailure(booking: any, errorMessage: string) {
    const organizerTime = this.formatTime(booking.startTime, booking.user.timezone);

    await this.send(
      booking.user.email,
      `⚠️ Booking NOT added to your calendar: ${booking.slotType.name} with ${booking.attendeeName}`,
      `<h2>⚠️ Calendar sync failed</h2>
<p>A booking was created but the Google Calendar event could <strong>not</strong> be created. Add it to your calendar manually so you don't miss it.</p>
<p><strong>When:</strong> ${organizerTime}</p>
<p><strong>Who:</strong> ${booking.attendeeName} (<a href="mailto:${booking.attendeeEmail}">${booking.attendeeEmail}</a>)</p>
<p><strong>Error:</strong> ${errorMessage}</p>
<p>If this keeps happening, reconnect your Google account in Settings → Calendars.</p>`,
    );
  }

  async sendCancellationNotice(booking: any) {
    const dateStr = format(booking.startTime, 'MMMM d yyyy');

    await Promise.all([
      this.send(
        booking.attendeeEmail,
        `Meeting Cancelled: ${booking.slotType.name}`,
        `<h2>Meeting Cancelled: ${booking.slotType.name}</h2>
<p>Your meeting on ${dateStr} has been cancelled.</p>`,
      ),
      this.send(
        booking.user.email,
        `Booking cancelled by ${booking.attendeeName}`,
        `<p>${booking.attendeeName} has cancelled their ${booking.slotType.name} booking on ${dateStr}.</p>`,
      ),
    ]);
  }

  async sendReminderEmail(booking: any) {
    const attendeeTime = this.formatTime(booking.startTime, booking.attendeeTimezone);
    const organizerTime = this.formatTime(booking.startTime, booking.user.timezone);

    await Promise.all([
      this.send(
        booking.attendeeEmail,
        `Reminder: ${booking.slotType.name} — ${attendeeTime}`,
        `<h2>Meeting Reminder: ${booking.slotType.name}</h2>
<p>Hi ${booking.attendeeName}, this is a reminder for your upcoming meeting.</p>
<p><strong>When:</strong> ${attendeeTime}</p>
${booking.meetingLink ? `<p><strong>Join:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
<p><strong>With:</strong> ${booking.user.name}</p>`,
      ),
      this.send(
        booking.user.email,
        `Reminder: ${booking.slotType.name} with ${booking.attendeeName}`,
        `<h2>Meeting Reminder: ${booking.slotType.name}</h2>
<p>You have an upcoming meeting with ${booking.attendeeName}.</p>
<p><strong>When:</strong> ${organizerTime}</p>
${booking.meetingLink ? `<p><strong>Join:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}`,
      ),
    ]);
  }
}
