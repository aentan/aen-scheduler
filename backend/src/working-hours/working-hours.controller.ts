import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkingHoursService } from './working-hours.service';

@Controller('api/working-hours')
@UseGuards(JwtAuthGuard)
export class WorkingHoursController {
  constructor(private workingHoursService: WorkingHoursService) {}

  @Get()
  getWorkingHours(@Req() req: any) {
    return this.workingHoursService.getWorkingHours(req.user.id);
  }

  @Put()
  updateWorkingHours(@Req() req: any, @Body() body: { hours: any[] }) {
    return this.workingHoursService.updateWorkingHours(req.user.id, body.hours);
  }

  @Get('breaks')
  getBreaks(@Req() req: any) {
    return this.workingHoursService.getBreaks(req.user.id);
  }

  @Post('breaks')
  upsertBreak(@Req() req: any, @Body() body: any) {
    return this.workingHoursService.upsertBreak(req.user.id, body);
  }

  @Delete('breaks/:id')
  deleteBreak(@Req() req: any, @Param('id') id: string) {
    return this.workingHoursService.deleteBreak(req.user.id, id);
  }

  @Get('holidays')
  getHolidays(@Req() req: any) {
    return this.workingHoursService.getHolidays(req.user.id);
  }

  @Post('holidays')
  upsertHoliday(@Req() req: any, @Body() body: any) {
    const data = { ...body, startDate: new Date(body.startDate), endDate: new Date(body.endDate) };
    return this.workingHoursService.upsertHoliday(req.user.id, data);
  }

  @Delete('holidays/:id')
  deleteHoliday(@Req() req: any, @Param('id') id: string) {
    return this.workingHoursService.deleteHoliday(req.user.id, id);
  }
}
