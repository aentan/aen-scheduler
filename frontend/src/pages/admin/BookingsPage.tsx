import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, isPast, isFuture } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/client';
import { Booking } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

type Tab = 'upcoming' | 'past' | 'cancelled';

function StatusBadge({ status }: { status: Booking['status'] }) {
  const map: Record<Booking['status'], string> = {
    booked: 'border-ink text-ink',
    rescheduled: 'border-[#6977fd] text-[#6977fd]',
    cancelled: 'border-[#ff0000] text-[#ff0000]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border font-mono text-sm font-bold uppercase tracking-wide ${map[status]}`}>
      {status}
    </span>
  );
}

function ConfirmDialog({
  open, title, description, confirmLabel, onConfirm, onCancel, loading,
}: {
  open: boolean; title: string; description: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-paper border border-ink max-w-sm w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <i className="hn hn-exclamation-triangle text-[#ff0000] flex-shrink-0 mt-0.5" style={{ fontSize: 16 }} />
          <div>
            <h3 className="font-mono font-bold text-ink">{title}</h3>
            <p className="font-mono text-sm text-emphasis-2 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 border border-ink font-mono text-sm text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50">
            Keep
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 border border-[#ff0000] font-mono text-sm font-bold text-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors disabled:opacity-50">
            {loading ? 'Cancelling...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; body: string }> = {
    upcoming: { title: 'No upcoming bookings', body: 'When someone books time with you, it will appear here.' },
    past: { title: 'No past bookings', body: 'Completed bookings will appear here.' },
    cancelled: { title: 'No cancelled bookings', body: 'Cancelled bookings will appear here.' },
  };
  const msg = messages[tab];
  return (
    <div className="text-center py-16">
      <i className="hn hn-calendar-alt text-emphasis-3 block text-center mb-3" style={{ fontSize: 32 }} />
      <p className="font-mono font-bold text-ink">{msg.title}</p>
      <p className="font-mono text-emphasis-2 text-sm mt-1">{msg.body}</p>
    </div>
  );
}

export function BookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => (await bookingsApi.list()).data,
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: (b: Booking) => bookingsApi.adminCancel(b.id),
    onSuccess: () => {
      toast.success('Booking cancelled.');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCancelTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel booking.'),
  });

  const timezone = user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  function formatDT(iso: string) {
    return formatInTimeZone(parseISO(iso), timezone, 'MMM d, yyyy h:mm a');
  }

  const filtered = bookings.filter((b) => {
    if (activeTab === 'cancelled') return b.status === 'cancelled';
    if (activeTab === 'upcoming') return b.status !== 'cancelled' && isFuture(parseISO(b.startTime));
    return b.status !== 'cancelled' && isPast(parseISO(b.startTime));
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  async function copyEmail(email: string) {
    await navigator.clipboard.writeText(email);
    toast.success('Email copied!');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 pb-4 border-b border-ink">
        <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">Bookings</h1>
        <p className="font-mono text-sm text-emphasis-2 mt-0.5">All times shown in {timezone}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border border-ink w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide transition-colors ${
              activeTab === t.key
                ? 'bg-ink text-paper'
                : 'bg-paper text-ink hover:bg-black/5 dark:hover:bg-white/5 border-l border-ink first:border-l-0'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border border-ink overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center font-mono text-emphasis-2 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="bg-paper border-b border-ink">
                  <th className="text-left px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm whitespace-nowrap text-ink">Date & Time</th>
                  <th className="text-left px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm text-ink">Attendee</th>
                  <th className="text-left px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm text-ink">Email</th>
                  <th className="text-left px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm whitespace-nowrap text-ink">Slot</th>
                  <th className="text-left px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm text-ink">Status</th>
                  <th className="text-right px-5 py-3 font-mono font-bold uppercase tracking-wide text-sm text-ink">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-ink">{formatDT(b.startTime)}</td>
                    <td className="px-5 py-3 font-bold text-ink">{b.attendeeName}</td>
                    <td className="px-5 py-3 text-ink">{b.attendeeEmail}</td>
                    <td className="px-5 py-3">
                      {b.slotType ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.slotType.color }} />
                          <span className="text-ink">{b.slotType.name}</span>
                        </div>
                      ) : <span className="text-emphasis-3">—</span>}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => copyEmail(b.attendeeEmail)}
                          className="inline-flex items-center px-2 py-1.5 text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
                          title="Copy email">
                          <i className="hn hn-copy" style={{ fontSize: 14, lineHeight: '20px' }} />
                        </button>
                        {b.status !== 'cancelled' && (
                          <button onClick={() => setCancelTarget(b)}
                            className="inline-flex items-center px-2 py-1.5 text-[#ff0000] border border-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors"
                            title="Cancel booking">
                            <i className="hn hn-trash" style={{ fontSize: 14, lineHeight: '20px' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel booking?"
        description={cancelTarget ? `This will cancel ${cancelTarget.attendeeName}'s booking on ${formatDT(cancelTarget.startTime)}. They will be notified by email.` : ''}
        confirmLabel="Cancel booking"
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
