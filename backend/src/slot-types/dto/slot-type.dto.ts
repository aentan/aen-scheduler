import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateSlotTypeDto {
  @IsString() name: string;
  @IsOptional() @IsString() slug?: string;
  @IsNumber() @Min(15) @Max(480) duration: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() calendarId?: string;
  @IsOptional() @IsString() color?: string;
  @IsNumber() @Min(1) @Max(20) maxBookingsPerDay: number;
  @IsNumber() @Min(0) @Max(120) bufferBefore: number;
  @IsNumber() @Min(0) @Max(120) bufferAfter: number;
  @IsOptional() @IsString() workingHoursStart?: string;
  @IsOptional() @IsString() workingHoursEnd?: string;
  @IsNumber() @Min(0) minAdvanceHours: number;
  @IsNumber() @Min(1) @Max(365) maxAdvanceDays: number;
  @IsOptional() @IsString() meetingLinkType?: string;
  @IsOptional() @IsString() customMeetingLink?: string;
}

export class UpdateSlotTypeDto extends CreateSlotTypeDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
