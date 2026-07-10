import React from 'react';

const COMMON_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Buenos_Aires', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam',
  'Europe/Stockholm', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'UTC',
];

interface Props {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full border border-ink px-3 py-2 font-mono text-sm text-ink bg-paper focus:outline-none ${className || ''}`}
    >
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}
