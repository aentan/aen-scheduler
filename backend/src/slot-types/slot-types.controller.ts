import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SlotTypesService } from './slot-types.service';
import { CreateSlotTypeDto, UpdateSlotTypeDto } from './dto/slot-type.dto';

@Controller('api/slot-types')
export class SlotTypesController {
  constructor(private slotTypesService: SlotTypesService) {}

  // Public endpoints (no auth)
  @Get('public/:id')
  getPublic(@Param('id') id: string) {
    return this.slotTypesService.findByIdPublic(id);
  }

  @Get('user/:userSlug/:slotSlug')
  getBySlug(@Param('userSlug') userSlug: string, @Param('slotSlug') slotSlug: string) {
    return this.slotTypesService.findBySlugPublic(userSlug, slotSlug);
  }

  @Get('user/:slug')
  getUserPublic(@Param('slug') slug: string, @Query('domain') domain?: string) {
    if (domain) return this.slotTypesService.findAllPublicForUser(domain, true);
    return this.slotTypesService.findAllPublicForUser(slug);
  }

  // Domain-based lookup (for custom domains)
  @Get('by-domain')
  getByDomain(@Query('host') host: string) {
    return this.slotTypesService.findAllPublicForUser(host, true);
  }

  // Authenticated endpoints
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any) {
    return this.slotTypesService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.slotTypesService.findById(id, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreateSlotTypeDto) {
    return this.slotTypesService.create(req.user.id, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSlotTypeDto) {
    return this.slotTypesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Req() req: any, @Param('id') id: string) {
    return this.slotTypesService.delete(id, req.user.id);
  }
}
