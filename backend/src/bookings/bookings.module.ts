import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CalendarsModule } from '../calendars/calendars.module';
import { AvailabilityModule } from '../availability/availability.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [CalendarsModule, AvailabilityModule, EmailModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
