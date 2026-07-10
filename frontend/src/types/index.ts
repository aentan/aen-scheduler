export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  slug: string;
  customDomain?: string;
  timezone: string;
  primaryCalendarId?: string;
  notifyOnBooking: boolean;
  sendReminders: boolean;
  reminderHours: number;
  theme: 'light' | 'dark' | 'system';
  applyThemeToAdmin: boolean;
  applyThemeToBooking: boolean;
  connectedCalendars: ConnectedCalendar[];
}

export interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  picture?: string;
  isPrimary: boolean;
  createdAt: string;
  connectedCalendars: { id: string; name: string }[];
}

export interface ConnectedCalendar {
  id: string;
  googleCalendarId: string;
  googleAccountId: string;
  name: string;
  description?: string;
  accessLevel: 'reader' | 'writer' | 'owner';
  isActive: boolean;
  backgroundColor?: string;
  googleAccount?: { id: string; email: string; name: string; picture?: string; isPrimary: boolean };
}

export interface SlotType {
  id: string;
  name: string;
  slug: string;
  duration: number;
  description?: string;
  calendarId?: string;
  calendar?: { name: string; googleCalendarId: string };
  color: string;
  maxBookingsPerDay: number;
  bufferBefore: number;
  bufferAfter: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  isActive: boolean;
  meetingLinkType: 'none' | 'google_meet' | 'zoom' | 'custom';
  customMeetingLink?: string;
  user?: { id: string; name: string; email: string; timezone: string; theme?: string; applyThemeToBooking?: boolean };
}

export interface Booking {
  id: string;
  slotTypeId: string;
  googleCalendarId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  attendeeTimezone: string;
  attendeeMessage?: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  status: 'booked' | 'rescheduled' | 'cancelled';
  cancelToken: string;
  rescheduleToken: string;
  createdAt: string;
  cancelledAt?: string;
  slotType?: { name: string; color: string; duration: number };
}

export interface WorkingHoursEntry {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
}

export interface Break {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
}

export interface Holiday {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface AvailabilityDay {
  date: string;
  slots: TimeSlot[];
}

export interface CreateBookingPayload {
  slotTypeId: string;
  userId: string;
  startTime: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  attendeeTimezone: string;
  attendeeMessage?: string;
  lockId?: string;
}
