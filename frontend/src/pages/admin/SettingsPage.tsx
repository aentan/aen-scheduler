import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { TimezoneSelector } from '../../components/shared/TimezoneSelector';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import { PillSwitch } from '../../components/shared/PillSwitch';

const inputCls =
  'w-full border border-ink px-3 py-2 font-mono text-sm text-ink bg-paper focus:outline-none';

const REMINDER_OPTIONS = [
  { value: 1, label: '1 hour before' },
  { value: 2, label: '2 hours before' },
  { value: 6, label: '6 hours before' },
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
];

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const sectionHeader =
  'px-5 py-3 border-b border-ink bg-paper flex items-center gap-3';

const primaryBtn =
  'px-4 py-2 bg-ink text-paper font-mono text-sm font-bold border border-ink hover:bg-paper hover:text-ink transition-colors disabled:opacity-40 whitespace-nowrap';

const secondaryBtn =
  'px-4 py-2 border border-ink font-mono text-sm text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50';

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, applyThemeToAdmin, applyThemeToBooking, setThemePrefs } = useTheme();
  const [domain, setDomain] = useState(user?.customDomain ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');

  const [notifyOnBooking, setNotifyOnBooking] = useState(user?.notifyOnBooking ?? true);
  const [sendReminders, setSendReminders] = useState(user?.sendReminders ?? false);
  const [reminderHours, setReminderHours] = useState(user?.reminderHours ?? 24);

  const themePrefsMutation = useMutation({
    mutationFn: (prefs: {
      theme?: string;
      applyThemeToAdmin?: boolean;
      applyThemeToBooking?: boolean;
    }) => usersApi.updateThemePrefs(prefs),
    onSuccess: () => refreshUser(),
    onError: () => toast.error('Failed to save theme preferences.'),
  });

  const handleThemeChange = (t: Theme) => {
    setThemePrefs({ theme: t });
    themePrefsMutation.mutate({ theme: t });
  };

  const handleApplyAdminToggle = (v: boolean) => {
    setThemePrefs({ applyThemeToAdmin: v });
    themePrefsMutation.mutate({ applyThemeToAdmin: v });
  };

  const handleApplyBookingToggle = (v: boolean) => {
    setThemePrefs({ applyThemeToBooking: v });
    themePrefsMutation.mutate({ applyThemeToBooking: v });
  };

  const timezoneMutation = useMutation({
    mutationFn: (tz: string) => usersApi.updateTimezone(tz),
    onSuccess: () => {
      toast.success('Timezone saved.');
      refreshUser();
    },
    onError: () => toast.error('Failed to save timezone.'),
  });

  const saveMutation = useMutation({
    mutationFn: (d: string | null) => usersApi.updateCustomDomain(d),
    onSuccess: () => {
      toast.success('Custom domain updated.');
      refreshUser();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update domain.'),
  });

  const emailPrefsMutation = useMutation({
    mutationFn: (prefs: {
      notifyOnBooking?: boolean;
      sendReminders?: boolean;
      reminderHours?: number;
    }) => usersApi.updateEmailPrefs(prefs),
    onSuccess: () => {
      toast.success('Email preferences saved.');
      refreshUser();
    },
    onError: () => toast.error('Failed to save email preferences.'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(domain.trim() || null);
  };

  const handleRemove = () => {
    setDomain('');
    saveMutation.mutate(null);
  };

  const handleNotifyToggle = (v: boolean) => {
    setNotifyOnBooking(v);
    emailPrefsMutation.mutate({ notifyOnBooking: v });
  };

  const handleRemindersToggle = (v: boolean) => {
    setSendReminders(v);
    emailPrefsMutation.mutate({ sendReminders: v });
  };

  const handleReminderHoursChange = (v: number) => {
    setReminderHours(v);
    emailPrefsMutation.mutate({ reminderHours: v });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="pb-4 border-b border-ink">
        <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">
          Settings
        </h1>
        <p className="font-mono text-sm text-emphasis-2 mt-0.5">
          Manage your account preferences.
        </p>
      </div>

      {/* Appearance */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <i className="hn hn-sun text-ink" style={{ fontSize: 32 }} />
          <div>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">
              Appearance
            </h2>
            <p className="font-mono text-sm text-emphasis-2">Choose your colour scheme.</p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div>
            <p className="font-mono text-sm font-bold text-ink mb-2">Theme</p>
            <div className="inline-flex border border-ink">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleThemeChange(opt.value)}
                  className={`px-4 py-1.5 font-mono text-sm transition-colors border-r border-ink last:border-r-0 ${
                    theme === opt.value
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-black/10 dark:border-white/10 pt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-ink">Apply to admin pages</p>
                <p className="font-mono text-sm text-emphasis-2 mt-0.5">
                  Use this theme in the admin dashboard.
                </p>
              </div>
              <PillSwitch checked={applyThemeToAdmin} onChange={handleApplyAdminToggle} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-ink">Apply to booking pages</p>
                <p className="font-mono text-sm text-emphasis-2 mt-0.5">
                  Show this theme to people booking through your public page.
                </p>
              </div>
              <PillSwitch checked={applyThemeToBooking} onChange={handleApplyBookingToggle} />
            </div>
          </div>
        </div>
      </section>

      {/* Timezone */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <i className="hn hn-clock text-ink" style={{ fontSize: 32 }} />
          <div>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">
              Timezone
            </h2>
            <p className="font-mono text-sm text-emphasis-2">
              Your local timezone for availability and bookings.
            </p>
          </div>
        </div>
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="flex-1">
            <TimezoneSelector
              value={timezone}
              onChange={setTimezone}
              className="border-ink font-mono"
            />
          </div>
          <button
            onClick={() => timezoneMutation.mutate(timezone)}
            disabled={timezoneMutation.isPending || timezone === user?.timezone}
            className={primaryBtn}
          >
            {timezoneMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Email Notifications */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <i className="hn hn-bell text-ink" style={{ fontSize: 32 }} />
          <div>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">
              Email Notifications
            </h2>
            <p className="font-mono text-sm text-emphasis-2">
              Control which emails you and your attendees receive.
            </p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm font-bold text-ink">Booking notifications</p>
              <p className="font-mono text-sm text-emphasis-2 mt-0.5">
                Email me when someone books a meeting.
              </p>
            </div>
            <PillSwitch checked={notifyOnBooking} onChange={handleNotifyToggle} />
          </div>

          <div className="border-t border-black/10 dark:border-white/10 pt-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-ink">Reminder emails</p>
                <p className="font-mono text-sm text-emphasis-2 mt-0.5">
                  Send reminders to you and attendees before each meeting.
                </p>
              </div>
              <PillSwitch checked={sendReminders} onChange={handleRemindersToggle} />
            </div>

            {sendReminders && (
              <div className="flex items-center gap-3">
                <label className="font-mono text-sm text-ink uppercase tracking-wide whitespace-nowrap">
                  Send
                </label>
                <select
                  value={reminderHours}
                  onChange={(e) => handleReminderHoursChange(Number(e.target.value))}
                  disabled={emailPrefsMutation.isPending}
                  className="border border-ink px-3 py-1.5 font-mono text-sm text-ink bg-paper focus:outline-none disabled:opacity-40"
                >
                  {REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Custom Domain */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <i className="hn hn-globe text-ink" style={{ fontSize: 32 }} />
          <div>
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">
              Custom Domain
            </h2>
            <p className="font-mono text-sm text-emphasis-2">
              Use your own domain for your booking page.
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1">
                Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="bookings.yourdomain.com"
                className={inputCls}
              />
              <p className="font-mono text-sm text-emphasis-2 mt-1">
                Point a CNAME record from your domain to your Fly.io app hostname.
              </p>
            </div>

            {user?.customDomain && (
              <div className="flex items-center gap-2 font-mono text-sm border border-ink px-3 py-2">
                <span className="font-bold text-ink">Active:</span>
                <a
                  href={`https://${user.customDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline flex items-center gap-1 hover:text-emphasis-2 transition-colors"
                >
                  {user.customDomain}
                  <i className="hn hn-external-link" style={{ fontSize: 12 }} />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saveMutation.isPending} className={primaryBtn}>
                {saveMutation.isPending ? 'Saving…' : 'Save Domain'}
              </button>
              {user?.customDomain && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saveMutation.isPending}
                  className={secondaryBtn}
                >
                  Remove
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10">
            <p className="font-mono text-sm font-bold text-ink uppercase tracking-wide mb-2">
              DNS Setup
            </p>
            <ol className="font-mono text-sm text-emphasis-2 space-y-1 list-decimal list-inside">
              <li>Log in to your DNS provider</li>
              <li>
                Create a <span className="font-bold text-ink">CNAME</span> record pointing your
                domain to your Fly.io app hostname
              </li>
              <li>Enter your custom domain above and save</li>
              <li>Wait for DNS propagation (up to 24 hours)</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
