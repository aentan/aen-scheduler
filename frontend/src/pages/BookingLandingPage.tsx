import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { slotTypesApi } from '../api/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import aenismLogo from '../assets/aenism-logo.svg';

interface PublicSlotType {
  id: string;
  name: string;
  slug: string;
  duration: number;
  description?: string;
  color: string;
}

interface PublicUser {
  id: string;
  name: string;
  slug: string;
  picture?: string;
  timezone: string;
  theme?: string;
  applyThemeToBooking?: boolean;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function BookingLandingPage() {
  const { slug } = useParams<{ slug?: string }>();
  const byDomain = !slug;
  const hostname = window.location.hostname;

  const { data, isLoading, isError } = useQuery<{ user: PublicUser; slotTypes: PublicSlotType[] }>({
    queryKey: byDomain ? ['domain-public', hostname] : ['user-public', slug],
    queryFn: async () => {
      if (byDomain) return (await slotTypesApi.getByDomain(hostname)).data;
      return (await slotTypesApi.getUserPublic(slug!)).data;
    },
    enabled: byDomain || !!slug,
    retry: false,
  });

  // Hooks must run on every render — keep them above the early returns
  // (loading/error) or React throws #310 when data arrives.
  const user = data?.user;

  useEffect(() => {
    if (!user?.name) return;
    document.title = `Book a time with ${user.name}`;
    return () => { document.title = 'AEN Scheduler'; };
  }, [user?.name]);

  useEffect(() => {
    if (!user) return;
    if (!user.applyThemeToBooking) {
      document.documentElement.classList.remove('dark');
      return;
    }
    const theme = user.theme ?? 'system';
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
  }, [user?.theme, user?.applyThemeToBooking]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graph-paper">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  if (isError || !data || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graph-paper">
        <div className="bg-paper border border-ink p-10 text-center max-w-sm">
          <p className="font-mono text-ink font-bold mb-2">Not found</p>
          <p className="font-mono text-sm text-emphasis-2">This booking page doesn't exist.</p>
        </div>
      </div>
    );
  }

  const { slotTypes } = data;

  return (
    <div className="min-h-screen bg-graph-paper">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Profile */}
        <div className="mb-10">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="font-mono font-bold text-ink text-xl uppercase tracking-wide">{user.name}</h1>
              <p className="font-mono text-sm text-emphasis-2 mt-0.5">Book a meeting</p>
            </div>
            <img src={aenismLogo} alt="aenism" className="h-10 w-auto flex-shrink-0 dark:invert" />
          </div>
          <div className="border-t border-ink" />
        </div>

        {/* Slot types */}
        {slotTypes.length === 0 ? (
          <p className="font-mono text-center text-emphasis-2 text-sm border border-ink p-8">
            No meeting types available.
          </p>
        ) : (
          <div className="space-y-0">
            {slotTypes.map((slot, i) => (
              <Link
                key={slot.id}
                to={byDomain ? `/${slot.slug}` : `/book/${user.slug}/${slot.slug}`}
                className={`block bg-paper border-l border-r border-b border-ink px-5 py-4 hover:bg-ink hover:text-paper transition-colors group ${
                  i === 0 ? 'border-t' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="font-kawingan text-ink group-hover:text-paper truncate">
                        {slot.name}
                      </p>
                      {slot.description && (
                        <p className="font-mono text-sm text-emphasis-2 group-hover:text-paper-62 mt-0.5 truncate">
                          {slot.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm text-emphasis-2 group-hover:text-paper-62 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDuration(slot.duration)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="font-mono text-sm text-emphasis-4 mt-10 text-center uppercase tracking-widest">
          Powered by AEN Scheduler
        </p>
      </div>
    </div>
  );
}
