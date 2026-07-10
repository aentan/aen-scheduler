import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import {
  addMinutes,
  startOfDay,
  endOfDay,
  parseISO,
  format,
  isWithinInterval,
  isBefore,
  isAfter,
  addDays,
  getDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface TimeSlot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
}

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private calendarsService: CalendarsService,
  ) {}

  async getAvailableSlots(
    userId: string,
    slotTypeId: string,
    dateFrom: Date,
    dateTo: Date,
    attendeeTimezone: string,
  ): Promise<{ date: string; slots: TimeSlot[] }[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const slotType = await this.prisma.slotType.findFirst({
      where: { id: slotTypeId, userId, isActive: true },
    });
    if (!slotType) throw new NotFoundException('Slot type not found');

    const userTz = user.timezone;
    const now = new Date();
    const minStart = addMinutes(now, slotType.minAdvanceHours * 60);
    const maxEnd = addDays(now, slotType.maxAdvanceDays);

    const actualFrom = isBefore(dateFrom, minStart) ? minStart : dateFrom;
    const actualTo = isAfter(dateTo, maxEnd) ? maxEnd : dateTo;
    if (isAfter(actualFrom, actualTo)) return [];

    const workingHours = await this.prisma.workingHours.findMany({ where: { userId } });
    const breaks = await this.prisma.break.findMany({ where: { userId } });
    const holidays = await this.prisma.holiday.findMany({
      where: { userId, startDate: { lte: actualTo }, endDate: { gte: actualFrom } },
    });

    const busyMap = await this.calendarsService.getFreeBusy(userId, actualFrom, actualTo);

    const allBusy: { start: Date; end: Date }[] = [];
    for (const periods of Object.values(busyMap)) {
      for (const p of periods) {
        allBusy.push({ start: new Date(p.start), end: new Date(p.end) });
      }
    }

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        userId,
        status: { not: 'cancelled' },
        startTime: { gte: actualFrom },
        endTime: { lte: actualTo },
      },
    });
    for (const b of existingBookings) {
      const bufBefore = addMinutes(b.startTime, -slotType.bufferBefore);
      const bufAfter = addMinutes(b.endTime, slotType.bufferAfter);
      allBusy.push({ start: bufBefore, end: bufAfter });
    }

    const activeLocks = await this.prisma.slotLock.findMany({
      where: { userId, expiresAt: { gt: now }, startTime: { gte: actualFrom, lte: actualTo } },
    });
    for (const lock of activeLocks) {
      allBusy.push({ start: lock.startTime, end: addMinutes(lock.startTime, slotType.duration) });
    }

    const result: { date: string; slots: TimeSlot[] }[] = [];

    let cursor = startOfDay(actualFrom);
    const limit = startOfDay(addDays(actualTo, 1));

    while (isBefore(cursor, limit)) {
      const daySlots = this.getSlotsForDay(
        cursor, slotType, workingHours, breaks, holidays, allBusy, userTz, minStart, maxEnd,
      );
      if (daySlots.length > 0) {
        result.push({
          date: format(toZonedTime(cursor, userTz), 'yyyy-MM-dd'),
          slots: daySlots,
        });
      }
      cursor = addDays(cursor, 1);
    }

    return result;
  }

  private getSlotsForDay(
    dayUtc: Date,
    slotType: any,
    workingHours: any[],
    breaks: any[],
    holidays: any[],
    allBusy: { start: Date; end: Date }[],
    userTz: string,
    minStart: Date,
    maxEnd: Date,
  ): TimeSlot[] {
    const dayZoned = toZonedTime(dayUtc, userTz);
    const dayOfWeek = getDay(dayZoned);

    const isHoliday = holidays.some((h) => {
      const s = startOfDay(toZonedTime(h.startDate, userTz));
      const e = endOfDay(toZonedTime(h.endDate, userTz));
      return !isBefore(dayZoned, s) && !isAfter(dayZoned, e);
    });
    if (isHoliday) return [];

    const wh = workingHours.find((w) => w.dayOfWeek === dayOfWeek);
    if (!wh || !wh.isEnabled) return [];

    const startHour = wh.startTime.split(':');
    const endHour = wh.endTime.split(':');
    const whOverrideStart = slotType.workingHoursStart ? slotType.workingHoursStart.split(':') : startHour;
    const whOverrideEnd = slotType.workingHoursEnd ? slotType.workingHoursEnd.split(':') : endHour;

    const dayStart = fromZonedTime(
      setMilliseconds(setSeconds(setMinutes(setHours(dayZoned, +whOverrideStart[0]), +whOverrideStart[1]), 0), 0),
      userTz,
    );
    const dayEnd = fromZonedTime(
      setMilliseconds(setSeconds(setMinutes(setHours(dayZoned, +whOverrideEnd[0]), +whOverrideEnd[1]), 0), 0),
      userTz,
    );

    const slots: TimeSlot[] = [];
    let slotStart = dayStart;

    while (isBefore(addMinutes(slotStart, slotType.duration), dayEnd) ||
           addMinutes(slotStart, slotType.duration).getTime() === dayEnd.getTime()) {
      const slotEnd = addMinutes(slotStart, slotType.duration);

      if (!isBefore(slotStart, minStart) && !isAfter(slotEnd, maxEnd)) {
        const conflictsBusy = allBusy.some(
          (b) => isBefore(slotStart, b.end) && isAfter(slotEnd, b.start),
        );

        const dayOfWeekForBreak = getDay(toZonedTime(slotStart, userTz));
        const conflictsBreak = breaks.some((brk) => {
          if (!brk.daysOfWeek.includes(dayOfWeekForBreak)) return false;
          const brkStartParts = brk.startTime.split(':');
          const brkEndParts = brk.endTime.split(':');
          const brkStart = fromZonedTime(
            setMilliseconds(setSeconds(setMinutes(setHours(dayZoned, +brkStartParts[0]), +brkStartParts[1]), 0), 0),
            userTz,
          );
          const brkEnd = fromZonedTime(
            setMilliseconds(setSeconds(setMinutes(setHours(dayZoned, +brkEndParts[0]), +brkEndParts[1]), 0), 0),
            userTz,
          );
          return isBefore(slotStart, brkEnd) && isAfter(slotEnd, brkStart);
        });

        if (!conflictsBusy && !conflictsBreak) {
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
      }

      slotStart = addMinutes(slotStart, 30);
    }

    return slots;
  }

  async lockSlot(userId: string, slotTypeId: string, startTime: Date): Promise<string> {
    await this.prisma.slotLock.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const existing = await this.prisma.slotLock.findFirst({
      where: { userId, slotTypeId, startTime, expiresAt: { gt: new Date() } },
    });
    if (existing) throw new Error('Slot is already locked');

    const lock = await this.prisma.slotLock.create({
      data: {
        userId,
        slotTypeId,
        startTime,
        expiresAt: addMinutes(new Date(), 5),
      },
    });
    return lock.id;
  }

  async releaseLock(lockId: string) {
    return this.prisma.slotLock.deleteMany({ where: { id: lockId } });
  }
}
