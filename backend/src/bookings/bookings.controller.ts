import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('api/bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 30000 } })
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getBookings(@Req() req: any, @Query('status') status?: string) {
    return this.bookingsService.getBookings(req.user.id, status);
  }

  @Post('cancel/:token')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  cancel(@Param('token') token: string, @Body() body: { reason?: string }) {
    return this.bookingsService.cancel(token, body.reason);
  }

  @Post('reschedule/:token')
  @Throttle({ default: { limit: 3, ttl: 30000 } })
  reschedule(@Param('token') token: string, @Body() body: { startTime: string }) {
    return this.bookingsService.reschedule(token, body.startTime);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  adminCancel(@Req() req: any, @Param('id') id: string) {
    return this.bookingsService.adminCancel(req.user.id, id);
  }

  @Get('by-token/:token')
  getByToken(@Param('token') token: string, @Query('type') type: 'cancel' | 'reschedule') {
    return this.bookingsService.getBookingByToken(token, type || 'cancel');
  }
}
