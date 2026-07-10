import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { bookingsApi, slotTypesApi, usersApi } from '../../api/client';
import { Booking, SlotType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, isFuture } from 'date-fns';
import toast from 'react-hot-toast';

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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1.5 font-mono text-sm text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
      title={`Copy ${label}`}
    >
      <i className={`hn ${copied ? 'hn-check' : 'hn-copy'}`} style={{ fontSize: 14, lineHeight: '20px' }} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SlugEditor({ currentSlug }: { currentSlug: string }) {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentSlug);

  const mutation = useMutation({
    mutationFn: (slug: string) => usersApi.updateSlug(slug),
    onSuccess: () => {
      toast.success('Booking URL updated.');
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      setEditing(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update URL.'),
  });

  const origin = window.location.origin;

  if (!editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-ink">
          {origin}/book/<span className="font-bold text-ink">{currentSlug}</span>
        </span>
        <button
          onClick={() => { setValue(currentSlug); setEditing(true); }}
          className="flex items-center gap-1 font-mono text-sm text-ink border border-ink px-2 py-1 hover:bg-ink hover:text-paper transition-colors"
        >
          <i className="hn hn-pencil" style={{ fontSize: 14 }} /> Edit
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(value); }}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="font-mono text-sm text-ink">{origin}/book/</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border border-ink px-2 py-1 font-mono text-sm text-ink bg-paper focus:outline-none w-32"
      />
      <button
        type="submit"
        disabled={mutation.isPending || !value.trim()}
        className="px-2 py-1 bg-ink text-paper font-mono text-sm font-bold border border-ink disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="p-1 text-ink"
      >
        <i className="hn hn-times" style={{ fontSize: 14 }} />
      </button>
    </form>
  );
}

export function DashboardHome() {
  const { user } = useAuth();

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => (await bookingsApi.list()).data,
    enabled: !!user,
  });

  const { data: slotTypes = [] } = useQuery<SlotType[]>({
    queryKey: ['slot-types'],
    queryFn: async () => (await slotTypesApi.list()).data,
    enabled: !!user,
  });

  const upcomingBookings = bookings.filter(
    (b) => b.status !== 'cancelled' && isFuture(parseISO(b.startTime)),
  );
  const activeSlotTypes = slotTypes.filter((s) => s.isActive);
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Total Bookings', value: bookings.filter((b) => b.status !== 'cancelled').length, iconCls: 'hn-calendar-alt' },
    { label: 'Upcoming', value: upcomingBookings.length, iconCls: 'hn-clock' },
    { label: 'Active Slots', value: activeSlotTypes.length, iconCls: 'hn-grid' },
  ];

  function getBookingUrl(slotSlug: string) {
    if (user?.customDomain) return `https://${user.customDomain}/${slotSlug}`;
    return `${window.location.origin}/book/${user?.slug}/${slotSlug}`;
  }

  const sectionHeader = 'flex items-center justify-between px-5 py-3 border-b border-ink bg-paper';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="border-b border-ink pb-4">
        <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">
          {user?.name?.split(' ')[0] ?? 'Dashboard'}
        </h1>
        <p className="font-mono text-sm text-emphasis-2 mt-0.5">Here's what's happening with your schedule.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
        {stats.map((s, i) => (
          <div key={s.label} className={`border border-ink p-5 flex items-center gap-4 ${i > 0 ? 'border-l-0' : ''}`}>
            <i className={`hn ${s.iconCls} text-ink flex-shrink-0`} style={{ fontSize: 20 }} />
            <div>
              <p className="font-mono font-bold text-ink text-2xl">{s.value}</p>
              <p className="font-mono text-sm text-ink uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/slot-types"
          className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper font-mono text-sm font-bold border border-ink hover:bg-paper hover:text-ink transition-colors"
        >
          Create Slot <i className="hn hn-arrow-right" style={{ fontSize: 14 }} />
        </Link>
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-paper text-ink font-mono text-sm font-bold border border-ink hover:bg-ink hover:text-paper transition-colors"
        >
          View All Bookings <i className="hn hn-arrow-right" style={{ fontSize: 14 }} />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <div className="border border-ink overflow-hidden">
          <div className={sectionHeader}>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">Recent Bookings</h2>
            <Link to="/admin/bookings" className="font-mono text-sm text-ink flex items-center gap-1">
              View all <i className="hn hn-arrow-right" style={{ fontSize: 12 }} />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="px-5 py-10 text-center font-mono text-emphasis-2 text-sm">No bookings yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {recentBookings.map((b) => (
                <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-ink truncate">{b.attendeeName}</p>
                    <p className="font-mono text-sm text-ink truncate">
                      {b.slotType?.name} &middot; {format(parseISO(b.startTime), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Booking links */}
        <div className="border border-ink overflow-hidden">
          <div className={sectionHeader}>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">Booking Links</h2>
            <Link to="/admin/slot-types" className="font-mono text-sm text-ink flex items-center gap-1">
              Manage <i className="hn hn-arrow-right" style={{ fontSize: 12 }} />
            </Link>
          </div>

          {user?.slug && (
            <div className="px-5 py-3 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <p className="font-mono text-sm text-emphasis-2 uppercase tracking-wide mb-1.5">Your booking page</p>
              <SlugEditor currentSlug={user.slug} />
              {user.customDomain && (
                <p className="font-mono text-sm text-ink mt-1.5">
                  Custom: <span className="text-ink font-bold">{user.customDomain}</span>
                </p>
              )}
            </div>
          )}

          {slotTypes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-mono text-emphasis-2 text-sm mb-3">No slots yet.</p>
              <Link to="/admin/slot-types" className="font-mono text-sm text-ink underline">
                Create your first slot
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {slotTypes.map((st) => {
                const url = getBookingUrl(st.slug);
                return (
                  <li key={st.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="font-kawingan text-ink truncate">{st.name}</span>
                        <span className="font-mono text-sm text-ink">{st.duration}m</span>
                        {!st.isActive && <span className="font-mono text-sm text-emphasis-3 italic">(inactive)</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1.5 text-ink border border-ink hover:bg-ink hover:text-paper transition-colors" title="Open">
                          <i className="hn hn-external-link" style={{ fontSize: 14, lineHeight: '20px' }} />
                        </a>
                        <CopyButton text={url} label="booking link" />
                      </div>
                    </div>
                    <p className="font-mono text-sm text-ink truncate">{url}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
