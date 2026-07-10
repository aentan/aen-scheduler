import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('api/availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get(':userId/:slotTypeId')
  async getAvailability(
    @Param('userId') userId: string,
    @Param('slotTypeId') slotTypeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tz') tz: string,
  ) {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    const timezone = tz || 'UTC';
    return this.availabilityService.getAvailableSlots(userId, slotTypeId, dateFrom, dateTo, timezone);
  }

  @Post('lock')
  async lockSlot(@Body() body: { userId: string; slotTypeId: string; startTime: string }) {
    const lockId = await this.availabilityService.lockSlot(
      body.userId,
      body.slotTypeId,
      new Date(body.startTime),
    );
    return { lockId };
  }

  @Post('unlock/:lockId')
  async unlockSlot(@Param('lockId') lockId: string) {
    await this.availabilityService.releaseLock(lockId);
    return { success: true };
  }
}
