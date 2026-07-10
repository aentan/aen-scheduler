import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { connectedCalendars: true },
    });
  }

  async findByCustomDomain(domain: string) {
    return this.prisma.user.findUnique({ where: { customDomain: domain } });
  }

  async create(data: { googleId: string; email: string; name: string; picture?: string }) {
    const slug = await this.generateUniqueSlug(data.name || data.email.split('@')[0]);
    return this.prisma.user.create({ data: { ...data, slug } });
  }

  async updateTimezone(id: string, timezone: string) {
    return this.prisma.user.update({ where: { id }, data: { timezone } });
  }

  async updatePrimaryCalendar(id: string, primaryCalendarId: string) {
    return this.prisma.user.update({ where: { id }, data: { primaryCalendarId } });
  }

  async updateSlug(id: string, slug: string) {
    const normalized = this.toSlug(slug);
    if (!normalized || normalized.length < 2) throw new BadRequestException('Slug must be at least 2 characters');
    if (normalized.length > 64) throw new BadRequestException('Slug must be 64 characters or fewer');
    const existing = await this.prisma.user.findFirst({ where: { slug: normalized, NOT: { id } } });
    if (existing) throw new BadRequestException('This URL is already taken');
    return this.prisma.user.update({ where: { id }, data: { slug: normalized } });
  }

  async updateEmailPrefs(id: string, prefs: { notifyOnBooking?: boolean; sendReminders?: boolean; reminderHours?: number }) {
    return this.prisma.user.update({ where: { id }, data: prefs });
  }

  async updateThemePrefs(id: string, prefs: { theme?: string; applyThemeToAdmin?: boolean; applyThemeToBooking?: boolean }) {
    return this.prisma.user.update({ where: { id }, data: prefs });
  }

  async updateCustomDomain(id: string, domain: string | null) {
    if (domain) {
      const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const existing = await this.prisma.user.findFirst({ where: { customDomain: normalized, NOT: { id } } });
      if (existing) throw new BadRequestException('This domain is already in use');
      return this.prisma.user.update({ where: { id }, data: { customDomain: normalized } });
    }
    return this.prisma.user.update({ where: { id }, data: { customDomain: null } });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { connectedCalendars: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async generateUniqueSlug(base: string): Promise<string> {
    const slug = this.toSlug(base) || 'user';
    let candidate = slug;
    let n = 2;
    while (await this.prisma.user.findUnique({ where: { slug: candidate } })) {
      candidate = `${slug}-${n++}`;
    }
    return candidate;
  }
}
