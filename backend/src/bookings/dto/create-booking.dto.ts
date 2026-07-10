import { IsString, IsEmail, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsString() slotTypeId: string;
  @IsString() userId: string;
  @IsString() @IsDateString() startTime: string;
  @IsString() attendeeName: string;
  @IsEmail() attendeeEmail: string;
  @IsOptional() @IsString() attendeePhone?: string;
  @IsString() attendeeTimezone: string;
  @IsOptional() @IsString() @MaxLength(1000) attendeeMessage?: string;
  @IsOptional() @IsString() lockId?: string;
}
