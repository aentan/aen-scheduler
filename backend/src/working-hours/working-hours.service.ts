import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_HOURS = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isEnabled: false },
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isEnabled: true },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isEnabled: true },
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isEnabled: true },
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isEnabled: true },
  { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isEnabled: true },
  { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isEnabled: false },
];

@Injectable()
export class WorkingHoursService {
  constructor(private prisma: PrismaService) {}

  async getWorkingHours(userId: string) {
    const stored = await this.prisma.workingHours.findMany({ where: { userId } });
    if (stored.length === 0) {
      await this.prisma.workingHours.createMany({
        data: DEFAULT_HOURS.map((h) => ({ ...h, userId })),
      });
      return this.prisma.workingHours.findMany({ where: { userId }, orderBy: { dayOfWeek: 'asc' } });
    }
    return stored.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  async updateWorkingHours(userId: string, hours: { dayOfWeek: number; startTime: string; endTime: string; isEnabled: boolean }[]) {
    await Promise.all(
      hours.map((h) =>
        this.prisma.workingHours.upsert({
          where: { userId_dayOfWeek: { userId, dayOfWeek: h.dayOfWeek } },
          update: { startTime: h.startTime, endTime: h.endTime, isEnabled: h.isEnabled },
          create: { userId, ...h },
        }),
      ),
    );
    return this.getWorkingHours(userId);
  }

  async getBreaks(userId: string) {
    return this.prisma.break.findMany({ where: { userId } });
  }

  async upsertBreak(userId: string, data: { id?: string; name: string; startTime: string; endTime: string; daysOfWeek: number[] }) {
    if (data.id) {
      return this.prisma.break.update({ where: { id: data.id }, data: { name: data.name, startTime: data.startTime, endTime: data.endTime, daysOfWeek: data.daysOfWeek } });
    }
    return this.prisma.break.create({ data: { userId, name: data.name, startTime: data.startTime, endTime: data.endTime, daysOfWeek: data.daysOfWeek } });
  }

  async deleteBreak(userId: string, id: string) {
    return this.prisma.break.deleteMany({ where: { id, userId } });
  }

  async getHolidays(userId: string) {
    return this.prisma.holiday.findMany({ where: { userId }, orderBy: { startDate: 'asc' } });
  }

  async upsertHoliday(userId: string, data: { id?: string; name: string; startDate: Date; endDate: Date }) {
    if (data.id) {
      return this.prisma.holiday.update({ where: { id: data.id }, data });
    }
    return this.prisma.holiday.create({ data: { userId, ...data } });
  }

  async deleteHoliday(userId: string, id: string) {
    return this.prisma.holiday.deleteMany({ where: { id, userId } });
  }
}
