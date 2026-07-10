import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotTypeDto, UpdateSlotTypeDto } from './dto/slot-type.dto';

@Injectable()
export class SlotTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.slotType.findMany({
      where: { userId },
      include: { calendar: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string, userId: string) {
    const slot = await this.prisma.slotType.findFirst({
      where: { id, userId },
      include: { calendar: true },
    });
    if (!slot) throw new NotFoundException('Slot type not found');
    return slot;
  }

  async create(userId: string, dto: CreateSlotTypeDto) {
    if (dto.calendarId) {
      const cal = await this.prisma.connectedCalendar.findFirst({
        where: { id: dto.calendarId, userId, isActive: true },
      });
      if (!cal) throw new BadRequestException('Calendar not found');
      if (cal.accessLevel === 'reader') throw new BadRequestException('Cannot write to a read-only calendar');
    }

    const baseSlug = dto.slug?.trim() || this.toSlug(dto.name);
    const slug = await this.generateUniqueSlug(userId, baseSlug);

    return this.prisma.slotType.create({
      data: { ...dto, slug, userId },
      include: { calendar: true },
    });
  }

  async update(id: string, userId: string, dto: UpdateSlotTypeDto) {
    const existing = await this.findById(id, userId);

    if (dto.calendarId) {
      const cal = await this.prisma.connectedCalendar.findFirst({
        where: { id: dto.calendarId, userId, isActive: true },
      });
      if (!cal) throw new BadRequestException('Calendar not found');
      if (cal.accessLevel === 'reader') throw new BadRequestException('Cannot write to a read-only calendar');
    }

    let newOldSlugs = existing.oldSlugs as string[];
    let newSlug: string | undefined;

    if (dto.slug) {
      // Explicit slug override
      const normalized = this.toSlug(dto.slug);
      const conflict = await this.prisma.slotType.findFirst({
        where: { userId, slug: normalized, NOT: { id } },
      });
      if (conflict) throw new BadRequestException('This URL slug is already in use');
      if (normalized !== existing.slug) {
        if (!newOldSlugs.includes(existing.slug)) newOldSlugs = [...newOldSlugs, existing.slug];
        newSlug = normalized;
      }
    } else if (dto.name && dto.name !== existing.name) {
      // Name changed — regenerate slug
      const generated = await this.generateUniqueSlug(userId, dto.name, id);
      if (generated !== existing.slug) {
        if (!newOldSlugs.includes(existing.slug)) newOldSlugs = [...newOldSlugs, existing.slug];
        newSlug = generated;
      }
    }

    return this.prisma.slotType.update({
      where: { id },
      data: { ...dto, ...(newSlug ? { slug: newSlug } : {}), oldSlugs: newOldSlugs },
      include: { calendar: true },
    });
  }

  async delete(id: string, userId: string) {
    await this.findById(id, userId);
    return this.prisma.slotType.delete({ where: { id } });
  }

  async findByIdPublic(id: string) {
    const slot = await this.prisma.slotType.findFirst({
      where: { id, isActive: true },
      include: {
        calendar: { select: { name: true, googleCalendarId: true } },
        user: { select: { id: true, name: true, slug: true, timezone: true, email: true, theme: true, applyThemeToBooking: true } },
      },
    });
    if (!slot) throw new NotFoundException('Slot type not found or inactive');
    return slot;
  }

  async findBySlugPublic(userSlug: string, slotSlug: string) {
    const user = await this.prisma.user.findUnique({ where: { slug: userSlug } });
    if (!user) throw new NotFoundException('User not found');

    const include = {
      calendar: { select: { name: true, googleCalendarId: true } },
      user: { select: { id: true, name: true, slug: true, timezone: true, email: true, theme: true, applyThemeToBooking: true } },
    };

    const slot = await this.prisma.slotType.findFirst({
      where: { userId: user.id, slug: slotSlug, isActive: true },
      include,
    });
    if (slot) return slot;

    // Fall back: check if this is an old slug
    const byOldSlug = await this.prisma.slotType.findFirst({
      where: { userId: user.id, oldSlugs: { has: slotSlug }, isActive: true },
      include,
    });
    if (!byOldSlug) throw new NotFoundException('Slot type not found or inactive');
    return byOldSlug;
  }

  async findAllPublicForUser(slugOrDomain: string, byDomain = false) {
    const where = byDomain ? { customDomain: slugOrDomain } : { slug: slugOrDomain };
    const user = await this.prisma.user.findUnique({
      where,
      select: { id: true, name: true, picture: true, slug: true, timezone: true, theme: true, applyThemeToBooking: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const slotTypes = await this.prisma.slotType.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, name: true, slug: true, duration: true, description: true, color: true },
      orderBy: { createdAt: 'asc' },
    });

    return { user, slotTypes };
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

  private async generateUniqueSlug(userId: string, base: string, excludeId?: string): Promise<string> {
    const slug = this.toSlug(base) || 'meeting';
    let candidate = slug;
    let n = 2;
    while (await this.prisma.slotType.findFirst({
      where: { userId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })) {
      candidate = `${slug}-${n++}`;
    }
    return candidate;
  }
}
