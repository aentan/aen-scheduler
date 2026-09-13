import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../api/client';
import { ConnectedCalendar, GoogleAccount } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

type AccessLevel = ConnectedCalendar['accessLevel'];

function AccessBadge({ level }: { level: AccessLevel }) {
  const map: Record<AccessLevel, { label: string; cls: string }> = {
    reader: { label: 'Read only', cls: 'border-ink/40 text-ink' },
    writer: { label: 'Read & Write', cls: 'border-ink text-ink' },
    owner: { label: 'Owner', cls: 'border-ink text-ink font-bold' },
  };
  const { label, cls } = map[level];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border font-mono text-sm uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function CalendarsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<ConnectedCalendar[]>({
    queryKey: ['calendars'],
    queryFn: async () => (await calendarsApi.list()).data,
    enabled: !!user,
  });

  const { data: googleAccounts = [], isLoading: accountsLoading } = useQuery<GoogleAccount[]>({
    queryKey: ['google-accounts'],
    queryFn: async () => (await calendarsApi.listGoogleAccounts()).data,
    enabled: !!user,
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarsApi.sync(),
    onSuccess: () => {
      toast.success('Calendars synced.');
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      queryClient.invalidateQueries({ queryKey: ['google-accounts'] });
    },
    onError: () => toast.error('Failed to sync calendars.'),
  });

  const disconnectCalendarMutation = useMutation({
    mutationFn: (googleCalendarId: string) => calendarsApi.disconnect(googleCalendarId),
    onSuccess: () => {
      toast.success('Calendar disconnected.');
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
    onError: () => toast.error('Failed to disconnect calendar.'),
  });

  const disconnectAccountMutation = useMutation({
    mutationFn: (accountId: string) => calendarsApi.disconnectGoogleAccount(accountId),
    onSuccess: () => {
      toast.success('Google account disconnected.');
      queryClient.invalidateQueries({ queryKey: ['google-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to disconnect account.'),
  });

  const connectAccountMutation = useMutation({
    mutationFn: () => calendarsApi.connectInitToken(),
    onSuccess: (res) => {
      const { connectToken } = res.data;
      window.location.href = `/api/auth/google/connect?ct=${connectToken}`;
    },
    onError: () => toast.error('Failed to initiate Google connection.'),
  });

  const writableCalendars = calendars.filter(
    (c) => c.accessLevel === 'writer' || c.accessLevel === 'owner',
  );
  const hasWritable = writableCalendars.length > 0;
  const isLoading = calendarsLoading || accountsLoading;
  const reauthAccounts = googleAccounts.filter((a) => a.needsReauth);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-ink">
        <div>
          <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">Calendars</h1>
          <p className="font-mono text-sm text-emphasis-2 mt-0.5">
            Connect Google accounts and manage which calendars are used for bookings.
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 border border-ink font-mono text-sm text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <i className={`hn hn-refresh ${syncMutation.isPending ? 'animate-spin' : ''}`} style={{ fontSize: 14 }} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync All'}
        </button>
      </div>

      {/* Re-auth warning */}
      {reauthAccounts.length > 0 && (
        <div className="flex items-start gap-3 border border-[#ff0000] px-4 py-3">
          <i className="hn hn-exclamation-triangle flex-shrink-0 mt-0.5 text-[#ff0000]" style={{ fontSize: 14 }} />
          <div className="flex-1">
            <p className="font-mono font-bold text-sm text-[#ff0000]">
              {reauthAccounts.length === 1 ? 'A Google account needs reconnecting' : 'Google accounts need reconnecting'}
            </p>
            <p className="font-mono text-sm text-emphasis-2 mt-0.5">
              {reauthAccounts.map((a) => a.email).join(', ')} lost access (token expired or revoked). Bookings to
              {reauthAccounts.length === 1 ? ' its' : ' their'} calendars are failing, and to avoid double-bookings
              those calendars are being treated as fully busy until reconnected.
            </p>
          </div>
        </div>
      )}

      {/* Google Accounts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono font-bold text-sm text-ink uppercase tracking-widest">Google Accounts</h2>
          <button
            onClick={() => connectAccountMutation.mutate()}
            disabled={connectAccountMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink text-paper font-mono text-sm font-bold border border-ink hover:bg-paper hover:text-ink transition-colors disabled:opacity-50"
          >
            <i className="hn hn-google" style={{ fontSize: 14 }} />
            Add Google Account
          </button>
        </div>

        <div className="border border-ink overflow-hidden">
          {accountsLoading ? (
            <div className="py-10 text-center font-mono text-emphasis-2 text-sm">Loading…</div>
          ) : googleAccounts.length === 0 ? (
            <div className="py-10 text-center font-mono text-emphasis-2 text-sm">No Google accounts connected.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {googleAccounts.map((account) => (
                <li key={account.id} className="flex items-center gap-4 px-5 py-4">
                  {account.picture ? (
                    <img src={account.picture} className="w-9 h-9 rounded-full border border-ink flex-shrink-0" alt=""
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-9 h-9 border border-ink flex items-center justify-center flex-shrink-0">
                      <i className="hn hn-user text-emphasis-3" style={{ fontSize: 14 }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm font-bold text-ink">{account.name}</p>
                      {account.isPrimary && (
                        <span className="font-mono text-sm border border-ink px-2 py-0.5 uppercase tracking-wide text-ink">
                          Primary
                        </span>
                      )}
                      {account.needsReauth && (
                        <span className="font-mono text-sm border border-[#ff0000] px-2 py-0.5 uppercase tracking-wide text-[#ff0000]">
                          Needs reconnect
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm text-ink mt-0.5">{account.email}</p>
                    <p className="font-mono text-sm text-ink">
                      {account.connectedCalendars.length} calendar{account.connectedCalendars.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {account.needsReauth && (
                      <button
                        onClick={() => connectAccountMutation.mutate()}
                        disabled={connectAccountMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff0000] text-white font-mono text-sm font-bold border border-[#ff0000] hover:bg-paper hover:text-[#ff0000] transition-colors disabled:opacity-50"
                      >
                        <i className="hn hn-refresh" style={{ fontSize: 14 }} /> Reconnect
                      </button>
                    )}
                    {!account.isPrimary && (
                      <button
                        onClick={() => disconnectAccountMutation.mutate(account.id)}
                        disabled={disconnectAccountMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#ff0000] font-mono text-sm text-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors disabled:opacity-50"
                      >
                        <i className="hn hn-trash" style={{ fontSize: 14 }} /> Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Warning */}
      {!isLoading && calendars.length > 0 && !hasWritable && (
        <div className="flex items-start gap-3 border border-ink px-4 py-3">
          <i className="hn hn-exclamation-triangle flex-shrink-0 mt-0.5 text-ink" style={{ fontSize: 14 }} />
          <div>
            <p className="font-mono font-bold text-sm text-ink">No writable calendars</p>
            <p className="font-mono text-sm text-emphasis-2 mt-0.5">
              You need at least one calendar with write access to create slots.
            </p>
          </div>
        </div>
      )}

      {/* Calendars */}
      <section>
        <h2 className="font-mono font-bold text-sm text-ink uppercase tracking-widest mb-3">Calendars</h2>

        <div className="border border-ink overflow-hidden">
          {calendarsLoading ? (
            <div className="py-16 text-center font-mono text-emphasis-2 text-sm">Loading calendars…</div>
          ) : calendars.length === 0 ? (
            <div className="py-16 text-center px-6">
              <i className="hn hn-calendar-alt text-emphasis-3 block text-center mb-3" style={{ fontSize: 32 }} />
              <p className="font-mono font-bold text-ink mb-1">No calendars yet</p>
              <p className="font-mono text-emphasis-2 text-sm mb-4">
                Add a Google account above, then click "Sync All" to import your calendars.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {calendars.map((cal) => (
                <li key={cal.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm font-bold text-ink truncate">{cal.name}</p>
                      <AccessBadge level={cal.accessLevel} />
                    </div>
                    {cal.googleCalendarId !== cal.name && (
                      <p className="font-mono text-sm text-ink truncate mt-0.5">{cal.googleCalendarId}</p>
                    )}
                    {cal.googleAccount && cal.googleAccount.email !== cal.name &&
                      cal.googleAccount.email !== cal.googleCalendarId && (
                      <p className="font-mono text-sm text-ink">{cal.googleAccount.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => disconnectCalendarMutation.mutate(cal.googleCalendarId)}
                    disabled={disconnectCalendarMutation.isPending}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink font-mono text-sm text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                  >
                    <i className="hn hn-times" style={{ fontSize: 14, lineHeight: '20px' }} /> Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {calendars.length > 0 && (
          <p className="font-mono text-sm text-emphasis-2 mt-3 text-right">
            {calendars.length} calendar{calendars.length !== 1 ? 's' : ''} &middot; {writableCalendars.length} writable
          </p>
        )}
      </section>
    </div>
  );
}
