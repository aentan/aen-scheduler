import { Module } from '@nestjs/common';
import { SlotTypesController } from './slot-types.controller';
import { SlotTypesService } from './slot-types.service';

@Module({
  controllers: [SlotTypesController],
  providers: [SlotTypesService],
  exports: [SlotTypesService],
})
export class SlotTypesModule {}
