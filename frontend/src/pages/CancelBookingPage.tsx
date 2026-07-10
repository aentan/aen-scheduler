import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Clock, Check } from 'lucide-react';
import { bookingsApi } from '../api/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import aenismLogo from '../assets/aenism-logo.svg';

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

export function CancelBookingPage() {
  const { token } = useParams<{ token: string }>();
  const tz = detectTimezone();
  const [cancelled, setCancelled] = useState(false);

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking-token', token],
    queryFn: () => bookingsApi.getByToken(token!, 'cancel').then((r) => r.data),
    enabled: !!token,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(token!),
    onSuccess: () => setCancelled(true),
  });

  const alreadyCancelled = booking?.status === 'cancelled' || booking?.status === 'rescheduled';

  useEffect(() => {
    if (booking?.slotType?.name) {
      document.title = `Cancel · ${booking.slotType.name}`;
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
    return <PageShell><ErrorBox message="This cancellation link is invalid or has expired." /></PageShell>;
  }

  const startTime = toZonedTime(parseISO(booking.startTime), tz);
  const dateStr = format(startTime, 'EEEE, MMMM d, yyyy');
  const timeStr = format(startTime, 'h:mm a');

  if (cancelled) {
    return (
      <PageShell>
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-black flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-mono font-bold text-black text-xl mb-2">Booking Cancelled</h2>
          <p className="font-mono text-sm text-emphasis-2">
            Your {booking.slotType.name} on {dateStr} has been cancelled.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h2 className="font-kawingan text-black text-xl mb-1">{booking.slotType.name}</h2>
      <p className="font-mono text-sm text-emphasis-2 uppercase tracking-widest mb-6">Cancel booking</p>

      <div className="flex items-start gap-3 px-4 py-3 border border-black mb-6">
        <Clock className="w-4 h-4 text-emphasis-2 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-mono text-sm font-bold text-black">{timeStr}</p>
          <p className="font-mono text-sm text-emphasis-2">{dateStr}</p>
        </div>
      </div>

      {alreadyCancelled ? (
        <p className="font-mono text-sm text-emphasis-2 text-center py-4">
          This booking has already been {booking.status}.
        </p>
      ) : (
        <>
          <p className="font-mono text-sm text-emphasis-2 mb-6">
            Are you sure you want to cancel this booking? This cannot be undone.
          </p>
          {cancelMutation.isError && (
            <p className="font-mono text-sm text-[#ff0000] mb-4">
              {(cancelMutation.error as any)?.response?.data?.message || 'Failed to cancel. Please try again.'}
            </p>
          )}
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="w-full py-2.5 bg-black text-white font-mono text-sm font-bold border border-black hover:bg-white hover:text-black transition-colors disabled:opacity-40"
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Booking'}
          </button>
        </>
      )}
    </PageShell>
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
