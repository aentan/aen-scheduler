import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { slotTypesApi, availabilityApi, bookingsApi } from '../api/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import {
  SlotTypeHeader,
  TimeSelectionStep,
  AttendeeFormStep,
  ConfirmationStep,
} from './PublicBookingPage';
import type { SlotType, TimeSlot, Booking } from '../types';

type Step = 'select' | 'form' | 'confirmed';

interface AttendeeForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

function detectTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

export function CustomDomainBookingPage() {
  const { slotSlug } = useParams<{ slotSlug: string }>();
  const hostname = window.location.hostname;
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [lockId, setLockId] = useState<string | null>(null);
  const [attendeeTimezone, setAttendeeTimezone] = useState(detectTimezone);
  const [form, setForm] = useState<AttendeeForm>({ name: '', email: '', phone: '', message: '' });
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const { data: domainData } = useQuery({
    queryKey: ['domain-public', hostname],
    queryFn: () => slotTypesApi.getByDomain(hostname).then((r) => r.data as { user: { slug: string } }),
    retry: false,
  });

  const userSlug = domainData?.user?.slug;

  const { data: slotType, isLoading, isError } = useQuery<SlotType>({
    queryKey: ['slotType', 'domain', hostname, slotSlug],
    queryFn: () => slotTypesApi.getBySlug(userSlug!, slotSlug!).then((r) => r.data as SlotType),
    enabled: !!userSlug && !!slotSlug,
    retry: 1,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const userId = slotType?.user?.id;
      if (!selectedSlot || !slotType || !userId) throw new Error('Missing data');
      const res = await bookingsApi.create({
        slotTypeId: slotType.id,
        userId,
        startTime: selectedSlot.start,
        attendeeName: form.name.trim(),
        attendeeEmail: form.email.trim(),
        attendeePhone: form.phone.trim() || undefined,
        attendeeTimezone,
        attendeeMessage: form.message.trim() || undefined,
        lockId: lockId ?? undefined,
      });
      return res.data as Booking;
    },
    onSuccess: (booking) => { setConfirmedBooking(booking); setStep('confirmed'); },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Booking failed. Please try again.';
      toast.error(msg);
      if (msg.toLowerCase().includes('no longer available') || msg.toLowerCase().includes('lock')) {
        setStep('select'); setSelectedSlot(null); setLockId(null);
      }
    },
  });

  useEffect(() => {
    return () => { if (lockId && step === 'form') availabilityApi.unlock(lockId).catch(() => {}); };
  }, [lockId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if we matched via an old slug
  useEffect(() => {
    if (slotType && slotType.slug !== slotSlug) {
      navigate(`/${slotType.slug}`, { replace: true });
    }
  }, [slotType, slotSlug, navigate]);

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

  const handleBack = async () => {
    if (lockId) { try { await availabilityApi.unlock(lockId); } catch {} setLockId(null); }
    setSelectedSlot(null); setStep('select');
  };

  if (isLoading || (!userSlug && !isError)) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  if (isError || !slotType) {
    return (
      <div className="min-h-screen bg-graph-paper flex items-center justify-center p-4">
        <div className="bg-paper border border-ink p-10 text-center max-w-sm">
          <h2 className="font-mono font-bold text-ink text-lg mb-2">Booking page not found</h2>
          <p className="font-mono text-sm text-emphasis-2">This booking link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (!slotType.isActive) {
    return (
      <div className="min-h-screen bg-graph-paper flex items-center justify-center p-4">
        <div className="bg-paper border border-ink p-10 text-center max-w-sm">
          <h2 className="font-mono font-bold text-ink text-lg mb-2">Bookings are paused</h2>
          <p className="font-mono text-sm text-emphasis-2">This meeting type is currently unavailable.</p>
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

            {step === 'select' && (
              <TimeSelectionStep
                userId={slotType.user!.id}
                slotTypeId={slotType.id}
                slotType={slotType}
                onSlotSelected={(slot, newLockId) => {
                  setSelectedSlot(slot); setLockId(newLockId); setStep('form');
                }}
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
