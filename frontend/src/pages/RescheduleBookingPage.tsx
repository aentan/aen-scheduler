import React, { useState, useEffect, Component } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Clock, Check } from 'lucide-react';
import { bookingsApi } from '../api/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { TimeSelectionStep } from './PublicBookingPage';
import aenismLogo from '../assets/aenism-logo.svg';
import type { TimeSlot } from '../types';

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

function safeFormatDate(isoString: string, tz: string, fmt: string): string {
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) return isoString;
    return format(toZonedTime(d, tz), fmt);
  } catch {
    return isoString;
  }
}

class RescheduleErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) {
      return (
        <PageShell>
          <p className="font-mono text-sm text-emphasis-2 text-center py-4">
            Something went wrong loading this page.<br />
            <span className="text-sm text-emphasis-3">{this.state.error}</span>
          </p>
        </PageShell>
      );
    }
    return this.props.children;
  }
}

export function RescheduleBookingPage() {
  const { token } = useParams<{ token: string }>();
  const tz = detectTimezone();
  const [rescheduled, setRescheduled] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking-token-reschedule', token],
    queryFn: () => bookingsApi.getByToken(token!, 'reschedule').then((r) => r.data),
    enabled: !!token,
    retry: false,
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => bookingsApi.reschedule(token!, selectedSlot!.start),
    onSuccess: () => setRescheduled(true),
  });

  useEffect(() => {
    if (booking?.slotType?.name) {
      document.title = `Reschedule · ${booking.slotType.name}`;
      return () => { document.title = 'AEN Scheduler'; };
    }
  }, [booking]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError || !booking) {
    return <PageShell><ErrorBox message="This reschedule link is invalid or has expired." /></PageShell>;
  }

  const alreadyCancelled = booking.status === 'cancelled' || booking.status === 'rescheduled';
  const slotName: string = booking.slotType?.name ?? 'Meeting';
  const dateStr = safeFormatDate(booking.startTime, tz, 'EEEE, MMMM d, yyyy');
  const timeStr = safeFormatDate(booking.startTime, tz, 'h:mm a');

  if (rescheduled) {
    return (
      <PageShell>
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-black flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-mono font-bold text-black text-xl mb-2">Booking Rescheduled</h2>
          <p className="font-mono text-sm text-emphasis-2">
            Your {slotName} has been moved. Check your email for the new details.
          </p>
        </div>
      </PageShell>
    );
  }

  if (alreadyCancelled) {
    return (
      <PageShell>
        <p className="font-mono text-sm text-emphasis-2 text-center py-4">
          This booking has already been {booking.status}.
        </p>
      </PageShell>
    );
  }

  const userId: string = booking.userId ?? booking.user?.id ?? '';
  const slotTypeId: string = booking.slotTypeId ?? '';
  const slotType = {
    ...(booking.slotType ?? {}),
    user: {
      id: userId,
      name: booking.user?.name ?? '',
      slug: booking.user?.slug ?? '',
      timezone: booking.user?.timezone ?? 'UTC',
      email: booking.user?.email ?? '',
    },
    connectedCalendars: [],
  } as any;

  return (
    <RescheduleErrorBoundary>
      <PageShell>
        <h2 className="font-kawingan text-black text-xl mb-1">{slotName}</h2>
        <p className="font-mono text-sm text-emphasis-2 uppercase tracking-widest mb-4">Reschedule booking</p>

        <div className="flex items-start gap-3 px-4 py-3 border border-black mb-6">
          <Clock className="w-4 h-4 text-emphasis-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-mono text-sm text-emphasis-2 mb-0.5">Current time</p>
            <p className="font-mono text-sm font-bold text-black">{timeStr}</p>
            <p className="font-mono text-sm text-emphasis-2">{dateStr}</p>
          </div>
        </div>

        {!selectedSlot ? (
          <TimeSelectionStep
            userId={userId}
            slotTypeId={slotTypeId}
            slotType={slotType}
            onSlotSelected={(slot) => setSelectedSlot(slot)}
          />
        ) : (
          <div>
            <div className="flex items-start gap-3 px-4 py-3 border border-black mb-6 bg-black/5">
              <Clock className="w-4 h-4 text-emphasis-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-mono text-sm text-emphasis-2 mb-0.5">New time</p>
                <p className="font-mono text-sm font-bold text-black">
                  {safeFormatDate(selectedSlot.start, tz, 'h:mm a')}
                </p>
                <p className="font-mono text-sm text-emphasis-2">
                  {safeFormatDate(selectedSlot.start, tz, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>

            {rescheduleMutation.isError && (
              <p className="font-mono text-sm text-[#ff0000] mb-4">
                {(rescheduleMutation.error as any)?.response?.data?.message || 'Failed to reschedule. Please try again.'}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSlot(null)}
                className="flex-1 py-2.5 border border-black font-mono text-sm text-black hover:bg-black hover:text-white transition-colors"
              >
                Pick Different Time
              </button>
              <button
                onClick={() => rescheduleMutation.mutate()}
                disabled={rescheduleMutation.isPending}
                className="flex-1 py-2.5 bg-black text-white font-mono text-sm font-bold border border-black hover:bg-white hover:text-black transition-colors disabled:opacity-40"
              >
                {rescheduleMutation.isPending ? 'Rescheduling…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </PageShell>
    </RescheduleErrorBoundary>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graph-paper">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="bg-white border border-black p-6 sm:p-8">
          <div className="mb-6 pb-5 border-b border-black flex items-center justify-between">
            <span className="font-mono text-sm text-emphasis-3 uppercase tracking-widest">meet.aen.is</span>
            <img src={aenismLogo} alt="aenism" className="h-7 w-auto" />
          </div>
          {children}
        </div>
        <p className="font-mono text-center text-sm text-emphasis-4 mt-6 uppercase tracking-widest">
          Powered by AEN Scheduler
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-center py-6">
      <p className="font-mono text-sm text-emphasis-2">{message}</p>
    </div>
  );
}
