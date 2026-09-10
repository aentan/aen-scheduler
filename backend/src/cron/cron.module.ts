import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { RemindersModule } from '../reminders/reminders.module';
import { CalendarsModule } from '../calendars/calendars.module';

@Module({
  imports: [RemindersModule, CalendarsModule],
  controllers: [CronController],
})
export class CronModule {}
