import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { CalendarsModule } from '../calendars/calendars.module';
import { WorkingHoursModule } from '../working-hours/working-hours.module';

@Module({
  imports: [CalendarsModule, WorkingHoursModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
