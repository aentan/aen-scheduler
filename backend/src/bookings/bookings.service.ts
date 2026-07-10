import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import { AvailabilityService } from '../availability/availability.service';
import { EmailService } from '../email/email.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { addMinutes, isAfter, subHours } from 'date-fns';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private calendarsService: CalendarsService,
    private availabilityService: AvailabilityService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateBookingDto) {
    const slotType = await this.prisma.slotType.findFirst({
      where: { id: dto.slotTypeId, userId: dto.userId, isActive: true },
      include: {
        calendar: true,
        user: true,
      },
    });
    if (!slotType) throw new NotFoundException('Slot type not found');

    const startTime = new Date(dto.startTime);
    const endTime = addMinutes(startTime, slotType.duration);

    const googleCalendarId = slotType.calendar?.googleCalendarId || slotType.user.primaryCalendarId;
    if (!googleCalendarId) throw new BadRequestException('No target calendar configured');

    const bookedToday = await this.prisma.booking.count({
      where: {
        userId: dto.userId,
        slotTypeId: dto.slotTypeId,
        status: { not: 'cancelled' },
        startTime: {
          gte: new Date(startTime.toDateString()),
          lt: new Date(new Date(startTime.toDateString()).getTime() + 86400000),
        },
      },
    });
    if (bookedToday >= slotType.maxBookingsPerDay) {
      throw new ConflictException('Maximum bookings for this day reached');
    }

    const conflictingBooking = await this.prisma.booking.findFirst({
      where: {
        userId: dto.userId,
        status: { not: 'cancelled' },
        OR: [
          { startTime: { gte: startTime, lt: endTime } },
          { endTime: { gt: startTime, lte: endTime } },
          { startTime: { lte: startTime }, endTime: { gte: endTime } },
        ],
      },
    });
    if (conflictingBooking) throw new ConflictException('This time slot is no longer available');

    const busyMap = await this.calendarsService.getFreeBusy(dto.userId, startTime, endTime);
    for (const busy of Object.values(busyMap)) {
      if (busy.length > 0) throw new ConflictException('This time slot is no longer available');
    }

    let googleEventId: string | undefined;
    let meetingLink: string | undefined;

    try {
      const gcalEvent = await this.calendarsService.createEvent(dto.userId, googleCalendarId, {
        summary: `${slotType.name} with ${dto.attendeeName}`,
        description: dto.attendeeMessage,
        startTime,
        endTime,
        attendeeEmail: dto.attendeeEmail,
        attendeeName: dto.attendeeName,
        conferenceType: slotType.meetingLinkType,
      });
      googleEventId = gcalEvent.id;
      meetingLink =
        gcalEvent.conferenceData?.entryPoints?.[0]?.uri ||
        slotType.customMeetingLink ||
        undefined;
    } catch (err) {
      console.error('Google Calendar event creation failed:', err.message);
    }

    const booking = await this.prisma.booking.create({
      data: {
        userId: dto.userId,
        slotTypeId: dto.slotTypeId,
        googleCalendarId,
        googleEventId,
        attendeeName: dto.attendeeName,
        attendeeEmail: dto.attendeeEmail,
        attendeePhone: dto.attendeePhone,
        attendeeTimezone: dto.attendeeTimezone,
        attendeeMessage: dto.attendeeMessage,
        startTime,
        endTime,
        meetingLink,
        status: 'booked',
      },
      include: { slotType: true, user: { select: { name: true, email: true, timezone: true, notifyOnBooking: true } } },
    });

    if (dto.lockId) {
      await this.availabilityService.releaseLock(dto.lockId).catch(() => {});
    }

    await this.emailService.sendBookingConfirmation(booking, { notifyOrganizer: booking.user.notifyOnBooking }).catch((err) =>
      console.error('Email send failed:', err.message),
    );

    return booking;
  }

  async getBookings(userId: string, status?: string) {
    return this.prisma.booking.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: {
        slotType: { select: { name: true, color: true, duration: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async getBookingByToken(token: string, type: 'cancel' | 'reschedule') {
    const where = type === 'cancel' ? { cancelToken: token } : { rescheduleToken: token };
    const booking = await this.prisma.booking.findFirst({ where, include: { slotType: true, user: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async adminCancel(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { slotType: true, user: { select: { name: true, email: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'cancelled') throw new BadRequestException('Already cancelled');

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
      include: { slotType: true, user: { select: { name: true, email: true } } },
    });

    if (booking.googleEventId) {
      await this.calendarsService
        .deleteEvent(booking.userId, booking.googleCalendarId, booking.googleEventId)
        .catch(() => {});
    }

    await this.emailService.sendCancellationNotice(updated).catch(() => {});
    return updated;
  }

  async cancel(token: string, reason?: string) {
    const booking = await this.getBookingByToken(token, 'cancel');
    if (booking.status === 'cancelled') throw new BadRequestException('Already cancelled');

    const cutoff = subHours(booking.startTime, 48);
    if (isAfter(new Date(), cutoff)) {
      throw new BadRequestException('Cancellation window has passed (48h before meeting)');
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
      include: { slotType: true, user: { select: { name: true, email: true } } },
    });

    if (booking.googleEventId) {
      await this.calendarsService
        .deleteEvent(booking.userId, booking.googleCalendarId, booking.googleEventId)
        .catch(() => {});
    }

    await this.emailService.sendCancellationNotice(updated).catch(() => {});
    return updated;
  }

  async reschedule(token: string, newStartTime: string) {
    const booking = await this.getBookingByToken(token, 'reschedule');
    if (booking.status === 'cancelled') throw new BadRequestException('Cannot reschedule cancelled booking');

    const cutoff = subHours(booking.startTime, 48);
    if (isAfter(new Date(), cutoff)) {
      throw new BadRequestException('Reschedule window has passed');
    }

    const oldEventId = booking.googleEventId;
    const oldCalendarId = booking.googleCalendarId;

    const newBooking = await this.create({
      slotTypeId: booking.slotTypeId,
      userId: booking.userId,
      startTime: newStartTime,
      attendeeName: booking.attendeeName,
      attendeeEmail: booking.attendeeEmail,
      attendeePhone: booking.attendeePhone,
      attendeeTimezone: booking.attendeeTimezone,
      attendeeMessage: booking.attendeeMessage,
    });

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'rescheduled', cancelledAt: new Date() },
    });

    if (oldEventId) {
      await this.calendarsService.deleteEvent(booking.userId, oldCalendarId, oldEventId).catch(() => {});
    }

    return newBooking;
  }
}
