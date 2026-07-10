import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import aenismLogo from '../assets/aenism-logo.svg';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isToday,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Video,
  Globe,
  User,
  Mail,
  Phone,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { slotTypesApi, availabilityApi, bookingsApi } from '../api/client';
import { TimezoneSelector } from '../components/shared/TimezoneSelector';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import type { SlotType, AvailabilityDay, TimeSlot, Booking } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'select' | 'form' | 'confirmed';

interface AttendeeForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}


function formatTimeInTz(isoString: string, tz: string): string {
  try {
    const zoned = toZonedTime(parseISO(isoString), tz);
    return format(zoned, 'h:mm a');
  } catch {
    return isoString;
  }
}

function formatDateInTz(isoString: string, tz: string): string {
  try {
    const zoned = toZonedTime(parseISO(isoString), tz);
    return format(zoned, 'EEEE, MMMM d, yyyy');
  } catch {
    return isoString;
  }
}

function buildGoogleCalendarUrl(
  title: string,
  startIso: string,
  endIso: string,
  description?: string,
  location?: string,
): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace('.000Z', 'Z').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startIso)}/${fmt(endIso)}`,
    details: description || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SlotTypeHeaderProps {
  slotType: SlotType;
}

export function SlotTypeHeader({ slotType }: SlotTypeHeaderProps) {
  return (
    <div className="mb-6 pb-5 border-b border-ink flex items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-emphasis-2 uppercase tracking-widest mb-2">
          {slotType.duration} minutes
        </p>
        <h1 className="font-kawingan text-ink text-2xl mb-1">{slotType.name}</h1>
        {slotType.user && (
          <p className="font-mono text-sm text-emphasis-2">
            with <span className="font-bold text-ink">{slotType.user.name}</span>
          </p>
        )}
        {slotType.description && (
          <p className="mt-2 font-mono text-sm text-emphasis-2 leading-relaxed">{slotType.description}</p>
        )}
      </div>
      <img src={aenismLogo} alt="aenism" className="h-10 w-auto flex-shrink-0 mt-1 dark:invert" />
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

interface CalendarGridProps {
  month: Date;
  availableDates: Set<string>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isLoading: boolean;
}

export function CalendarGrid({
  month,
  availableDates,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  isLoading,
}: CalendarGridProps) {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const isAvailable = (date: Date) => availableDates.has(format(date, 'yyyy-MM-dd'));
  const isPast = (date: Date) => isBefore(startOfDay(date), today);
  const isCurrentMonth = (date: Date) => format(date, 'yyyy-MM') === format(month, 'yyyy-MM');

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="p-1.5 border border-ink hover:bg-ink hover:text-paper transition-colors text-ink"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-mono font-bold text-ink text-sm uppercase tracking-widest">
          {format(month, 'MMMM yyyy')}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-1.5 border border-ink hover:bg-ink hover:text-paper transition-colors text-ink"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center font-mono text-sm font-bold text-emphasis-3 py-1 uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 z-10">
            <LoadingSpinner size="md" />
          </div>
        )}
        {days.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const available = isAvailable(date) && !isPast(date) && isCurrentMonth(date);
          const past = isPast(date) || !isCurrentMonth(date);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const todayDate = isToday(date);

          return (
            <div key={dateStr} className="flex items-center justify-center py-0.5">
              <button
                disabled={!available}
                onClick={() => available && onSelectDate(date)}
                aria-label={format(date, 'MMMM d, yyyy')}
                aria-pressed={isSelected}
                className={[
                  'h-9 w-9 font-mono text-sm font-medium transition-all focus:outline-none',
                  isSelected
                    ? 'bg-ink text-paper'
                    : available
                    ? 'border border-ink text-ink hover:bg-ink hover:text-paper'
                    : past
                    ? 'text-emphasis-4 cursor-default'
                    : 'text-emphasis-4 cursor-default',
                  todayDate && !isSelected && available ? 'font-bold' : '',
                ].join(' ')}
              >
                {format(date, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Slot List ───────────────────────────────────────────────────────────

interface TimeSlotListProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  timezone: string;
  isLocking: boolean;
}

export function TimeSlotList({
  slots,
  selectedSlot,
  onSelectSlot,
  timezone,
  isLocking,
}: TimeSlotListProps) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 border border-black/20 dark:border-white/20 p-4 text-center">
        <Clock className="h-5 w-5 mb-2 text-emphasis-4" />
        <p className="font-mono text-sm text-emphasis-2">No available times</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 max-h-80 overflow-y-auto">
      {slots.map((slot, i) => {
        const isSelected = selectedSlot?.start === slot.start;
        const time = formatTimeInTz(slot.start, timezone);

        return (
          <button
            key={slot.start}
            onClick={() => onSelectSlot(slot)}
            disabled={isLocking}
            className={[
              `w-full text-left px-3 py-2.5 font-mono text-sm font-medium transition-all focus:outline-none border-l border-r border-b`,
              i === 0 ? 'border-t' : '',
              isSelected
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper text-ink border-ink hover:bg-ink hover:text-paper',
              isLocking && !isSelected ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <span>{time}</span>
            {isSelected && isLocking && (
              <span className="ml-2 text-sm opacity-75">Holding...</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 1: Time Selection ───────────────────────────────────────────────────

interface TimeSelectionStepProps {
  userId: string;
  slotTypeId: string;
  slotType: SlotType;
  onSlotSelected: (slot: TimeSlot, lockId: string) => void;
}

export function TimeSelectionStep({
  userId,
  slotTypeId,
  slotType,
  onSlotSelected,
}: TimeSelectionStepProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [timezone, setTimezone] = useState(detectTimezone);

  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ['availability', userId, slotTypeId, format(month, 'yyyy-MM'), timezone],
    queryFn: async () => {
      const from = format(startOfMonth(month), "yyyy-MM-dd'T'00:00:00'Z'");
      const to = format(endOfMonth(month), "yyyy-MM-dd'T'23:59:59'Z'");
      const res = await availabilityApi.get(userId, slotTypeId, from, to, timezone);
      return res.data as AvailabilityDay[];
    },
    staleTime: 60_000,
  });

  const availableDates = React.useMemo<Set<string>>(() => {
    if (!availabilityData) return new Set();
    const set = new Set<string>();
    for (const day of availabilityData) {
      if (day.slots.length > 0) {
        try { set.add(day.date.substring(0, 10)); } catch { /* ignore */ }
      }
    }
    return set;
  }, [availabilityData]);

  const slotsForDate = React.useMemo<TimeSlot[]>(() => {
    if (!selectedDate || !availabilityData) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const day = availabilityData.find((d) => d.date.substring(0, 10) === dateStr);
    return day?.slots ?? [];
  }, [selectedDate, availabilityData]);

  const lockMutation = useMutation({
    mutationFn: async (slot: TimeSlot) => {
      const res = await availabilityApi.lock({ userId, slotTypeId, startTime: slot.start });
      return { slot, lockId: res.data.lockId as string };
    },
    onSuccess: ({ slot, lockId }) => { onSlotSelected(slot, lockId); },
    onError: () => {
      toast.error('That slot is no longer available. Please pick another time.');
      setSelectedSlot(null);
    },
  });

  const handleSelectSlot = useCallback(
    (slot: TimeSlot) => { setSelectedSlot(slot); lockMutation.mutate(slot); },
    [lockMutation],
  );

  const handlePrevMonth = () => {
    const prev = subMonths(month, 1);
    if (isBefore(prev, startOfMonth(new Date()))) return;
    setMonth(prev);
    setSelectedDate(null);
  };

  const handleNextMonth = () => { setMonth(addMonths(month, 1)); setSelectedDate(null); };
  const handleSelectDate = (date: Date) => { setSelectedDate(date); setSelectedSlot(null); };

  return (
    <div>
      {/* Timezone row */}
      <div className="flex items-center gap-2 mb-5 border border-ink px-3 py-2">
        <Globe className="h-3.5 w-3.5 text-emphasis-2 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <TimezoneSelector
            value={timezone}
            onChange={(tz) => { setTimezone(tz); setSelectedDate(null); setSelectedSlot(null); }}
            className="bg-transparent border-none shadow-none text-sm text-ink p-0 focus:ring-0 font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <CalendarGrid
            month={month}
            availableDates={availableDates}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            isLoading={isLoading}
          />
        </div>

        {selectedDate && (
          <div className="md:w-44 lg:w-52 flex-shrink-0">
            <h3 className="font-mono text-sm font-bold text-ink uppercase tracking-widest mb-3">
              {format(selectedDate, 'EEE, MMM d')}
            </h3>
            <TimeSlotList
              slots={slotsForDate}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              timezone={timezone}
              isLocking={lockMutation.isPending}
            />
          </div>
        )}

        {!selectedDate && (
          <div className="md:w-44 lg:w-52 flex-shrink-0 flex flex-col items-center justify-center border border-black/30 dark:border-white/30 p-6 text-center">
            <Calendar className="h-6 w-6 mb-2 text-emphasis-4" />
            <p className="font-mono text-sm text-emphasis-3 leading-relaxed">
              Select a date to see available times
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Attendee Form ────────────────────────────────────────────────────

interface AttendeeFormStepProps {
  slot: TimeSlot;
  slotType: SlotType;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  form: AttendeeForm;
  onFormChange: (form: AttendeeForm) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function AttendeeFormStep({
  slot,
  slotType,
  timezone,
  onTimezoneChange,
  form,
  onFormChange,
  onBack,
  onSubmit,
  isSubmitting,
}: AttendeeFormStepProps) {
  const [errors, setErrors] = useState<Partial<AttendeeForm>>({});

  const validate = (): boolean => {
    const newErrors: Partial<AttendeeForm> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (form.message.length > 500) newErrors.message = 'Message must be 500 characters or fewer';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (validate()) onSubmit(); };
  const set = (field: keyof AttendeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onFormChange({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div>
      {/* Selected time summary */}
      <div className="flex items-center gap-3 px-4 py-3 border border-ink mb-6">
        <Clock className="h-4 w-4 text-emphasis-2 flex-shrink-0" />
        <div>
          <p className="font-mono text-sm font-bold text-ink">
            {formatTimeInTz(slot.start, timezone)} – {formatTimeInTz(slot.end, timezone)}
          </p>
          <p className="font-mono text-sm text-emphasis-2">{formatDateInTz(slot.start, timezone)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Name */}
        <div>
          <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
            Your Name <span className="text-[#ff0000]">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emphasis-3" />
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Jane Smith"
              className={`block w-full pl-9 pr-3 py-2.5 border font-mono text-sm text-ink bg-paper focus:outline-none ${
                errors.name ? 'border-[#ff0000]' : 'border-ink'
              }`}
            />
          </div>
          {errors.name && <p className="mt-1 font-mono text-sm text-[#ff0000]">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
            Email <span className="text-[#ff0000]">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emphasis-3" />
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="jane@example.com"
              className={`block w-full pl-9 pr-3 py-2.5 border font-mono text-sm text-ink bg-paper focus:outline-none ${
                errors.email ? 'border-[#ff0000]' : 'border-ink'
              }`}
            />
          </div>
          {errors.email && <p className="mt-1 font-mono text-sm text-[#ff0000]">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
            Phone <span className="font-normal text-emphasis-3 normal-case">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emphasis-3" />
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 555 000 0000"
              className="block w-full pl-9 pr-3 py-2.5 border border-ink font-mono text-sm text-ink bg-paper focus:outline-none"
            />
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
            Notes <span className="font-normal text-emphasis-3 normal-case">(optional)</span>
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-3.5 w-3.5 text-emphasis-3" />
            <textarea
              value={form.message}
              onChange={set('message')}
              placeholder="Anything you'd like to share before the meeting..."
              rows={3}
              maxLength={500}
              className={`block w-full pl-9 pr-3 py-2.5 border font-mono text-sm text-ink bg-paper focus:outline-none resize-none ${
                errors.message ? 'border-[#ff0000]' : 'border-ink'
              }`}
            />
          </div>
          <div className="flex justify-between mt-1">
            {errors.message ? (
              <p className="font-mono text-sm text-[#ff0000]">{errors.message}</p>
            ) : <span />}
            <p className="font-mono text-sm text-emphasis-4 ml-auto">{form.message.length}/500</p>
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
            Timezone
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emphasis-3 pointer-events-none z-10" />
            <TimezoneSelector value={timezone} onChange={onTimezoneChange} className="pl-9 border-ink font-mono" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-ink font-mono text-sm font-bold text-ink bg-paper hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 font-mono text-sm font-bold text-paper bg-ink border border-ink hover:bg-paper hover:text-ink transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><LoadingSpinner size="sm" className="border-paper" /> Booking...</>
            ) : 'Book Meeting'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Step 3: Confirmation ─────────────────────────────────────────────────────

interface ConfirmationStepProps {
  booking: Booking;
  slotType: SlotType;
  timezone: string;
}

export function ConfirmationStep({ booking, slotType, timezone }: ConfirmationStepProps) {
  const gcalUrl = buildGoogleCalendarUrl(
    slotType.name,
    booking.startTime,
    booking.endTime,
    booking.meetingLink ? `Meeting link: ${booking.meetingLink}` : undefined,
    booking.meetingLink || undefined,
  );

  return (
    <div className="text-center">
      {/* Success icon */}
      <div className="flex justify-center mb-5">
        <div className="h-14 w-14 border-2 border-ink flex items-center justify-center">
          <Check className="h-7 w-7 text-ink" strokeWidth={3} />
        </div>
      </div>

      <h2 className="font-mono font-bold text-ink text-xl mb-1">Booked.</h2>
      <p className="font-mono text-sm text-emphasis-2 mb-6">
        Confirmation sent to{' '}
        <span className="font-bold text-ink">{booking.attendeeEmail}</span>
      </p>

      {/* Booking summary */}
      <div className="border border-ink p-4 text-left space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-emphasis-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-sm text-emphasis-2 uppercase tracking-wide">Meeting</p>
            <p className="font-mono text-sm font-bold text-ink">{slotType.name}</p>
            {slotType.user && (
              <p className="font-mono text-sm text-emphasis-2">with {slotType.user.name}</p>
            )}
          </div>
        </div>

        <div className="border-t border-black/10 dark:border-white/10 pt-3 flex items-start gap-3">
          <Clock className="h-4 w-4 text-emphasis-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-sm text-emphasis-2 uppercase tracking-wide">Date & Time</p>
            <p className="font-mono text-sm font-bold text-ink">
              {formatTimeInTz(booking.startTime, timezone)} – {formatTimeInTz(booking.endTime, timezone)}
            </p>
            <p className="font-mono text-sm text-emphasis-2">{formatDateInTz(booking.startTime, timezone)}</p>
            <p className="font-mono text-sm text-emphasis-3">{timezone.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {booking.meetingLink && (
          <div className="border-t border-black/10 dark:border-white/10 pt-3 flex items-start gap-3">
            <Video className="h-4 w-4 text-emphasis-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-sm text-emphasis-2 uppercase tracking-wide">Meeting Link</p>
              <a
                href={booking.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm font-bold text-ink underline flex items-center gap-1"
              >
                Join Meeting <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="space-y-2">
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-ink font-mono text-sm font-bold text-ink hover:bg-ink hover:text-paper transition-colors"
        >
          <Calendar className="h-4 w-4" />
          Add to Google Calendar
        </a>
        <a
          href={window.location.href}
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-ink font-mono text-sm font-bold text-paper border border-ink hover:bg-paper hover:text-ink transition-colors"
        >
          Book another meeting
        </a>
      </div>
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: Step;
}

function StepIndicator({ current }: StepIndicatorProps) {
  const steps: { key: Step; label: string }[] = [
    { key: 'select', label: 'Select Time' },
    { key: 'form', label: 'Your Details' },
    { key: 'confirmed', label: 'Confirmed' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center">
            <div
              className={`h-7 w-7 border-2 flex items-center justify-center font-mono text-sm font-bold transition-colors ${
                idx <= currentIdx
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-emphasis-4 border-black/30 dark:border-white/30'
              }`}
            >
              {idx < currentIdx ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : idx + 1}
            </div>
            <span
              className={`font-mono text-sm mt-1 uppercase tracking-wide ${
                idx === currentIdx ? 'text-ink font-bold' : 'text-emphasis-4'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`h-px w-12 mx-1 mb-5 ${idx < currentIdx ? 'bg-ink' : 'bg-black/20 dark:bg-white/20'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PublicBookingPage() {
  const { slug, slotSlug } = useParams<{ slug: string; slotSlug: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [lockId, setLockId] = useState<string | null>(null);
  const [attendeeTimezone, setAttendeeTimezone] = useState(detectTimezone);
  const [form, setForm] = useState<AttendeeForm>({ name: '', email: '', phone: '', message: '' });
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const {
    data: slotType,
    isLoading: isLoadingSlotType,
    isError: isSlotTypeError,
  } = useQuery<SlotType>({
    queryKey: ['slotType', 'public', slug, slotSlug],
    queryFn: async () => {
      const res = await slotTypesApi.getBySlug(slug!, slotSlug!);
      return res.data as SlotType;
    },
    enabled: !!slug && !!slotSlug,
    retry: 1,
  });

  // Redirect if we matched via an old slug
  useEffect(() => {
    if (slotType && slotType.slug !== slotSlug) {
      navigate(`/book/${slug}/${slotType.slug}`, { replace: true });
    }
  }, [slotType, slotSlug, slug, navigate]);

  useEffect(() => {
    if (slotType) {
      const who = slotType.user?.name ? ` with ${slotType.user.name}` : '';
      document.title = `${slotType.name}${who} · Book a time`;
      return () => { document.title = 'AEN Scheduler'; };
    }
  }, [slotType]);

  useEffect(() => {
    const u = slotType?.user;
    if (!u?.applyThemeToBooking) {
      document.documentElement.classList.remove('dark');
      return;
    }
    const theme = u.theme ?? 'system';
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    isDark
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark');
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) =>
      e.matches
        ? document.documentElement.classList.add('dark')
        : document.documentElement.classList.remove('dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [slotType?.user?.theme, slotType?.user?.applyThemeToBooking]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const userId = slotType?.user?.id;
      if (!selectedSlot || !slotType || !userId) throw new Error('Missing data');
      const payload = {
        slotTypeId: slotType.id,
        userId,
        startTime: selectedSlot.start,
        attendeeName: form.name.trim(),
        attendeeEmail: form.email.trim(),
        attendeePhone: form.phone.trim() || undefined,
        attendeeTimezone,
        attendeeMessage: form.message.trim() || undefined,
        lockId: lockId ?? undefined,
      };
      const res = await bookingsApi.create(payload);
      return res.data as Booking;
    },
    onSuccess: (booking) => { setConfirmedBooking(booking); setStep('confirmed'); },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Booking failed. Please try again.';
      if (
        typeof msg === 'string' &&
        (msg.toLowerCase().includes('no longer available') ||
          msg.toLowerCase().includes('already booked') ||
          msg.toLowerCase().includes('lock'))
      ) {
        toast.error('That time slot is no longer available. Please go back and select another time.');
        setStep('select');
        setSelectedSlot(null);
        setLockId(null);
      } else {
        toast.error(msg);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (lockId && step === 'form') availabilityApi.unlock(lockId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockId]);

  const handleSlotSelected = (slot: TimeSlot, newLockId: string) => {
    setSelectedSlot(slot);
    setLockId(newLockId);
    setStep('form');
  };

  const handleBack = async () => {
    if (lockId) {
      try { await availabilityApi.unlock(lockId); } catch { /* ignore */ }
      setLockId(null);
    }
    setSelectedSlot(null);
    setStep('select');
  };

  if (isLoadingSlotType) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  if (isSlotTypeError || !slotType) {
    return (
      <div className="min-h-screen bg-graph-paper flex items-center justify-center p-4">
        <div className="bg-paper border border-ink p-10 text-center max-w-sm">
          <h2 className="font-mono font-bold text-ink text-lg mb-2">Booking page not found</h2>
          <p className="font-mono text-sm text-emphasis-2">
            This booking link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (!slotType.isActive) {
    return (
      <div className="min-h-screen bg-graph-paper flex items-center justify-center p-4">
        <div className="bg-paper border border-ink p-10 text-center max-w-sm">
          <h2 className="font-mono font-bold text-ink text-lg mb-2">Bookings are paused</h2>
          <p className="font-mono text-sm text-emphasis-2">
            This meeting type is currently unavailable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graph-paper">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="bg-paper border border-ink">
          <div className="p-6 sm:p-8">
            <SlotTypeHeader slotType={slotType} />

            {step !== 'confirmed' && (
              <StepIndicator current={step} />
            )}

            {step === 'select' && (
              <TimeSelectionStep
                userId={slotType.user!.id}
                slotTypeId={slotType.id}
                slotType={slotType}
                onSlotSelected={handleSlotSelected}
              />
            )}

            {step === 'form' && selectedSlot && (
              <AttendeeFormStep
                slot={selectedSlot}
                slotType={slotType}
                timezone={attendeeTimezone}
                onTimezoneChange={setAttendeeTimezone}
                form={form}
                onFormChange={setForm}
                onBack={handleBack}
                onSubmit={() => bookMutation.mutate()}
                isSubmitting={bookMutation.isPending}
              />
            )}

            {step === 'confirmed' && confirmedBooking && (
              <ConfirmationStep
                booking={confirmedBooking}
                slotType={slotType}
                timezone={attendeeTimezone}
              />
            )}
          </div>
        </div>

        <p className="font-mono text-center text-sm text-emphasis-4 mt-6 uppercase tracking-widest">
          Powered by AEN Scheduler
        </p>
      </div>
    </div>
  );
}
