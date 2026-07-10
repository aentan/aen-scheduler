import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import aenismLogo from '../../assets/aenism-logo.svg';

const NAV = [
  { to: '/admin', label: 'Dashboard', iconCls: 'hn-grid' },
  { to: '/admin/bookings', label: 'Bookings', iconCls: 'hn-bullet-list' },
  { to: '/admin/slot-types', label: 'Slots', iconCls: 'hn-clock' },
  { to: '/admin/availability', label: 'Availability', iconCls: 'hn-calendar-alt' },
  { to: '/admin/calendars', label: 'Calendars', iconCls: 'hn-calendar-alt' },
  { to: '/admin/settings', label: 'Settings', iconCls: 'hn-cog' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-paper">
      <aside className="w-56 border-r border-ink flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-ink">
          <div className="inline-block">
            <img src={aenismLogo} alt="aenism" className="h-8 w-auto dark:invert" />
            <span className="block font-mono text-sm text-emphasis-2 uppercase tracking-[0.2em] mt-1.5">SCHEDULER</span>
          </div>
          {user && (
            <div className="mt-4 flex items-center gap-2 min-w-0">
              {user.picture && (
                <img
                  src={user.picture}
                  alt=""
                  className="h-6 w-6 rounded-full border border-ink flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">{user.name}</p>
                <p className="text-sm text-ink truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(({ to, label, iconCls }) => {
            const active =
              location.pathname === to ||
              (to !== '/admin' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-5 py-2.5 text-base font-mono transition-colors ${
                  active
                    ? 'bg-ink text-paper font-bold'
                    : 'text-ink hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <i className={`hn ${iconCls} flex-shrink-0`} style={{ fontSize: 24 }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t border-ink">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-base font-mono text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <i className="hn hn-logout flex-shrink-0" style={{ fontSize: 24 }} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-paper">{children}</main>
    </div>
  );
}
