import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workingHoursApi } from '../../api/client';
import { WorkingHoursEntry, Break, Holiday } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { PillSwitch } from '../../components/shared/PillSwitch';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DEFAULT_HOURS: WorkingHoursEntry[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  startTime: '09:00',
  endTime: '17:00',
  isEnabled: i >= 1 && i <= 5,
}));

const inputCls =
  'border border-ink px-2 py-1.5 font-mono text-sm text-ink bg-paper focus:outline-none';
const primaryBtn =
  'px-3 py-1 bg-ink text-paper font-mono text-sm font-bold border border-ink hover:bg-paper hover:text-ink transition-colors disabled:opacity-50';
const sectionHeader =
  'px-5 py-3 border-b border-ink bg-paper flex items-center justify-between';


export function AvailabilityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [hours, setHours] = useState<WorkingHoursEntry[]>(DEFAULT_HOURS);
  const { data: hoursData } = useQuery<WorkingHoursEntry[]>({
    queryKey: ['working-hours'],
    queryFn: async () => (await workingHoursApi.get()).data,
    enabled: !!user,
  });

  useEffect(() => {
    if (hoursData && hoursData.length > 0) {
      const merged = DEFAULT_HOURS.map((def) => {
        const found = hoursData.find((h) => h.dayOfWeek === def.dayOfWeek);
        return found ?? def;
      });
      setHours(merged);
    }
  }, [hoursData]);

  const saveHoursMutation = useMutation({
    mutationFn: () => workingHoursApi.update(hours),
    onSuccess: () => {
      toast.success('Working hours saved.');
      queryClient.invalidateQueries({ queryKey: ['working-hours'] });
    },
    onError: () => toast.error('Failed to save working hours.'),
  });

  function setHourField(idx: number, field: keyof WorkingHoursEntry, value: string | boolean) {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }

  const { data: breaksData = [] } = useQuery<Break[]>({
    queryKey: ['breaks'],
    queryFn: async () => (await workingHoursApi.getBreaks()).data,
    enabled: !!user,
  });

  const [breaks, setBreaks] = useState<Break[]>([]);
  useEffect(() => { setBreaks(breaksData); }, [breaksData]);

  const upsertBreakMutation = useMutation({
    mutationFn: (b: Break) => workingHoursApi.upsertBreak(b),
    onSuccess: () => {
      toast.success('Break saved.');
      queryClient.invalidateQueries({ queryKey: ['breaks'] });
    },
    onError: () => toast.error('Failed to save break.'),
  });

  const deleteBreakMutation = useMutation({
    mutationFn: (id: string) => workingHoursApi.deleteBreak(id),
    onSuccess: () => {
      toast.success('Break removed.');
      queryClient.invalidateQueries({ queryKey: ['breaks'] });
    },
    onError: () => toast.error('Failed to delete break.'),
  });

  function addBreak() {
    setBreaks((prev) => [...prev, { name: '', startTime: '12:00', endTime: '13:00', daysOfWeek: [1, 2, 3, 4, 5] }]);
  }

  function setBreakField(idx: number, field: keyof Break, value: string | number[]) {
    setBreaks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  }

  function toggleBreakDay(idx: number, day: number) {
    setBreaks((prev) => prev.map((b, i) => {
      if (i !== idx) return b;
      const days = b.daysOfWeek.includes(day)
        ? b.daysOfWeek.filter((d) => d !== day)
        : [...b.daysOfWeek, day].sort((a, c) => a - c);
      return { ...b, daysOfWeek: days };
    }));
  }

  function saveBreak(b: Break) {
    if (!b.name.trim()) { toast.error('Break name is required.'); return; }
    upsertBreakMutation.mutate(b);
  }

  function removeBreak(b: Break, idx: number) {
    if (b.id) { deleteBreakMutation.mutate(b.id); }
    else { setBreaks((prev) => prev.filter((_, i) => i !== idx)); }
  }

  const { data: holidaysData = [] } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: async () => (await workingHoursApi.getHolidays()).data,
    enabled: !!user,
  });

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => { setHolidays(holidaysData); }, [holidaysData]);

  const upsertHolidayMutation = useMutation({
    mutationFn: (h: Holiday) => workingHoursApi.upsertHoliday(h),
    onSuccess: () => {
      toast.success('Holiday saved.');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: () => toast.error('Failed to save holiday.'),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => workingHoursApi.deleteHoliday(id),
    onSuccess: () => {
      toast.success('Holiday removed.');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: () => toast.error('Failed to delete holiday.'),
  });

  function addHoliday() {
    const today = new Date().toISOString().slice(0, 10);
    setHolidays((prev) => [...prev, { name: '', startDate: today, endDate: today }]);
  }

  function setHolidayField(idx: number, field: keyof Holiday, value: string) {
    setHolidays((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }

  function saveHoliday(h: Holiday) {
    if (!h.name.trim()) { toast.error('Holiday name is required.'); return; }
    upsertHolidayMutation.mutate(h);
  }

  function removeHoliday(h: Holiday, idx: number) {
    if (h.id) { deleteHolidayMutation.mutate(h.id); }
    else { setHolidays((prev) => prev.filter((_, i) => i !== idx)); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div className="pb-4 border-b border-ink">
        <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">Availability</h1>
        <p className="font-mono text-sm text-emphasis-2 mt-0.5">Configure your working hours, breaks, and time off.</p>
      </div>

      {/* Timezone notice */}
      <div className="flex items-center gap-2 border border-ink px-4 py-3 font-mono text-sm">
        <i className="hn hn-globe flex-shrink-0 text-emphasis-2" style={{ fontSize: 14 }} />
        <span className="text-ink">
          Timezone: <strong className="text-ink">{user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
        </span>
      </div>

      {/* Working Hours */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <div className="flex items-center gap-2 text-ink">
            <i className="hn hn-clock" style={{ fontSize: 32 }} />
            <h2 className="font-mono font-bold text-sm uppercase tracking-wide">Working Hours</h2>
          </div>
          <button onClick={() => saveHoursMutation.mutate()} disabled={saveHoursMutation.isPending}
            className={primaryBtn}>
            {saveHoursMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {hours.map((h, idx) => (
            <div key={h.dayOfWeek} className={`flex items-center gap-4 px-5 py-3 min-h-[58px] ${!h.isEnabled ? 'opacity-40' : ''}`}>
              <PillSwitch
                checked={h.isEnabled}
                onClick={() => setHourField(idx, 'isEnabled', !h.isEnabled)}
              />
              <span className="w-24 font-mono text-sm text-ink font-bold">{DAY_NAMES[h.dayOfWeek]}</span>
              {h.isEnabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={h.startTime}
                    onChange={(e) => setHourField(idx, 'startTime', e.target.value)} className={inputCls} />
                  <span className="font-mono text-emphasis-3">—</span>
                  <input type="time" value={h.endTime}
                    onChange={(e) => setHourField(idx, 'endTime', e.target.value)} className={inputCls} />
                </div>
              ) : (
                <span className="font-mono text-sm text-emphasis-3 italic">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Breaks */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">Breaks</h2>
          <button onClick={addBreak}
            className={`inline-flex items-center gap-1 ${primaryBtn}`}>
            <i className="hn hn-plus" style={{ fontSize: 14 }} /> Add Break
          </button>
        </div>
        {breaks.length === 0 ? (
          <div className="px-5 py-8 text-center font-mono text-emphasis-2 text-sm">
            No breaks configured. Add a lunch break or any recurring break.
          </div>
        ) : (
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {breaks.map((b, idx) => (
              <div key={idx} className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input type="text" value={b.name}
                    onChange={(e) => setBreakField(idx, 'name', e.target.value)}
                    placeholder="Break name (e.g. Lunch)" className={`flex-1 ${inputCls}`} />
                  <input type="time" value={b.startTime}
                    onChange={(e) => setBreakField(idx, 'startTime', e.target.value)} className={inputCls} />
                  <span className="font-mono text-emphasis-3">—</span>
                  <input type="time" value={b.endTime}
                    onChange={(e) => setBreakField(idx, 'endTime', e.target.value)} className={inputCls} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    {DAY_ABBR.map((d, di) => (
                      <button key={di} type="button" onClick={() => toggleBreakDay(idx, di)}
                        className={`w-8 h-8 font-mono text-sm font-bold border transition-colors ${
                          b.daysOfWeek.includes(di)
                            ? 'bg-ink text-paper border-ink'
                            : 'bg-paper text-ink border-ink hover:bg-ink hover:text-paper'
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveBreak(b)} disabled={upsertBreakMutation.isPending}
                      className={primaryBtn}>
                      Save
                    </button>
                    <button onClick={() => removeBreak(b, idx)} disabled={deleteBreakMutation.isPending}
                      className="inline-flex items-center px-2 py-1.5 text-[#ff0000] border border-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors disabled:opacity-50">
                      <i className="hn hn-trash" style={{ fontSize: 14, lineHeight: '20px' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Holidays */}
      <section className="border border-ink overflow-hidden">
        <div className={sectionHeader}>
          <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">Holidays & Time Off</h2>
          <button onClick={addHoliday}
            className={`inline-flex items-center gap-1 ${primaryBtn}`}>
            <i className="hn hn-plus" style={{ fontSize: 14 }} /> Add
          </button>
        </div>
        {holidays.length === 0 ? (
          <div className="px-5 py-8 text-center font-mono text-emphasis-2 text-sm">
            No holidays or time off configured.
          </div>
        ) : (
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {holidays.map((h, idx) => (
              <div key={idx} className="px-5 py-4 flex items-center gap-3">
                <input type="text" value={h.name}
                  onChange={(e) => setHolidayField(idx, 'name', e.target.value)}
                  placeholder="e.g. Christmas, Vacation" className={`flex-1 ${inputCls}`} />
                <input type="date" value={h.startDate}
                  onChange={(e) => setHolidayField(idx, 'startDate', e.target.value)} className={inputCls} />
                <span className="font-mono text-emphasis-3">—</span>
                <input type="date" value={h.endDate}
                  onChange={(e) => setHolidayField(idx, 'endDate', e.target.value)} className={inputCls} />
                <button onClick={() => saveHoliday(h)} disabled={upsertHolidayMutation.isPending}
                  className={`${primaryBtn} whitespace-nowrap`}>
                  Save
                </button>
                <button onClick={() => removeHoliday(h, idx)} disabled={deleteHolidayMutation.isPending}
                  className="inline-flex items-center px-2 py-1.5 text-[#ff0000] border border-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors disabled:opacity-50 flex-shrink-0">
                  <i className="hn hn-trash" style={{ fontSize: 14, lineHeight: '20px' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
