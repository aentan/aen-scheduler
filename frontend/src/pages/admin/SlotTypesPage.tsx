import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { slotTypesApi, calendarsApi } from '../../api/client';
import { SlotType, ConnectedCalendar } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { PillSwitch } from '../../components/shared/PillSwitch';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const MEETING_LINK_TYPES: { value: SlotType['meetingLinkType']; label: string }[] = [
  { value: 'none', label: 'No link' },
  { value: 'google_meet', label: 'Google Meet (auto)' },
  { value: 'custom', label: 'Custom link' },
];

interface SlotTypeFormData {
  name: string;
  duration: number;
  description: string;
  calendarId: string;
  color: string;
  maxBookingsPerDay: number;
  bufferBefore: number;
  bufferAfter: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  meetingLinkType: SlotType['meetingLinkType'];
  customMeetingLink: string;
}

const defaultForm: SlotTypeFormData = {
  name: '',
  duration: 30,
  description: '',
  calendarId: '',
  color: PRESET_COLORS[0],
  maxBookingsPerDay: 8,
  bufferBefore: 0,
  bufferAfter: 0,
  workingHoursStart: '',
  workingHoursEnd: '',
  minAdvanceHours: 1,
  maxAdvanceDays: 60,
  meetingLinkType: 'none',
  customMeetingLink: '',
};

function formFromSlotType(s: SlotType): SlotTypeFormData {
  return {
    name: s.name,
    duration: s.duration,
    description: s.description ?? '',
    calendarId: s.calendarId ?? '',
    color: s.color,
    maxBookingsPerDay: s.maxBookingsPerDay,
    bufferBefore: s.bufferBefore,
    bufferAfter: s.bufferAfter,
    workingHoursStart: s.workingHoursStart ?? '',
    workingHoursEnd: s.workingHoursEnd ?? '',
    minAdvanceHours: s.minAdvanceHours,
    maxAdvanceDays: s.maxAdvanceDays,
    meetingLinkType: s.meetingLinkType,
    customMeetingLink: s.customMeetingLink ?? '',
  };
}

const inputCls =
  'w-full border border-ink px-3 py-2 font-mono text-sm text-ink bg-paper focus:outline-none';
const labelCls =
  'block font-mono text-sm font-bold text-ink uppercase tracking-wide mb-1';
const primaryBtn =
  'px-4 py-2 bg-ink text-paper font-mono text-sm font-bold border border-ink hover:bg-paper hover:text-ink transition-colors disabled:opacity-50';
const secondaryBtn =
  'px-4 py-2 border border-ink font-mono text-sm text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50';

function SlotTypeForm({
  initial,
  writableCalendars,
  onSave,
  onCancel,
  loading,
}: {
  initial: SlotTypeFormData;
  writableCalendars: ConnectedCalendar[];
  onSave: (data: SlotTypeFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<SlotTypeFormData>(initial);

  function set<K extends keyof SlotTypeFormData>(key: K, value: SlotTypeFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.calendarId) { toast.error('Please select a calendar.'); return; }
    if (form.workingHoursStart && !form.workingHoursEnd) { toast.error('Please set working hours end time.'); return; }
    if (!form.workingHoursStart && form.workingHoursEnd) { toast.error('Please set working hours start time.'); return; }
    if (form.meetingLinkType === 'custom' && !form.customMeetingLink.trim()) { toast.error('Please enter a custom meeting link.'); return; }
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls}>Name *</label>
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. 30-minute intro call" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Duration</label>
        <select value={form.duration} onChange={(e) => set('duration', Number(e.target.value))} className={inputCls}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
          rows={2} placeholder="Optional description shown to bookers"
          className={`${inputCls} resize-none`} />
      </div>

      <div>
        <label className={labelCls}>Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                form.color === c ? 'border-ink scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Calendar *</label>
        {writableCalendars.length === 0 ? (
          <p className="font-mono text-sm text-emphasis-2 border border-ink/30 px-3 py-2">
            No writable calendars. Sync calendars first.
          </p>
        ) : (
          <select value={form.calendarId}
            onChange={(e) => set('calendarId', e.target.value)} className={inputCls}>
            <option value="">Select a calendar…</option>
            {writableCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Max/day</label>
          <input type="number" min={1} max={50} value={form.maxBookingsPerDay}
            onChange={(e) => set('maxBookingsPerDay', Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Buffer before</label>
          <input type="number" min={0} max={120} value={form.bufferBefore}
            onChange={(e) => set('bufferBefore', Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Buffer after</label>
          <input type="number" min={0} max={120} value={form.bufferAfter}
            onChange={(e) => set('bufferAfter', Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Min advance (hours)</label>
          <input type="number" min={0} value={form.minAdvanceHours}
            onChange={(e) => set('minAdvanceHours', Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Max advance (days)</label>
          <input type="number" min={1} value={form.maxAdvanceDays}
            onChange={(e) => set('maxAdvanceDays', Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>
          Working hours override{' '}
          <span className="font-normal normal-case text-emphasis-2">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-sm text-ink mb-1">Start</label>
            <input type="time" value={form.workingHoursStart}
              onChange={(e) => set('workingHoursStart', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block font-mono text-sm text-ink mb-1">End</label>
            <input type="time" value={form.workingHoursEnd}
              onChange={(e) => set('workingHoursEnd', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Meeting link</label>
        <select value={form.meetingLinkType}
          onChange={(e) => set('meetingLinkType', e.target.value as SlotType['meetingLinkType'])}
          className={inputCls}>
          {MEETING_LINK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {form.meetingLinkType === 'custom' && (
          <input type="url" value={form.customMeetingLink}
            onChange={(e) => set('customMeetingLink', e.target.value)}
            placeholder="https://meet.example.com/my-room"
            className={`${inputCls} mt-2`} />
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-black/10 dark:border-white/10">
        <button type="button" onClick={onCancel} disabled={loading} className={secondaryBtn}>
          Cancel
        </button>
        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function copyBookingLink(slug: string, slotSlug: string, customDomain?: string | null) {
  const url = customDomain
    ? `https://${customDomain}/${slotSlug}`
    : `${window.location.origin}/book/${slug}/${slotSlug}`;
  navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
}

function SlideOver({
  open, title, onClose, headerAction, children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`fixed inset-0 z-50 flex justify-end transition-all ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className={`relative w-full max-w-lg bg-paper h-full border-l border-ink flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink bg-paper">
          <h2 className="font-mono font-bold text-sm uppercase tracking-wide text-ink">{title}</h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button onClick={onClose} className="p-1 text-ink">
              <i className="hn hn-times" style={{ fontSize: 20 }} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function SlotTypesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SlotType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotType | null>(null);

  const { data: slotTypes = [], isLoading } = useQuery<SlotType[]>({
    queryKey: ['slot-types'],
    queryFn: async () => (await slotTypesApi.list()).data,
    enabled: !!user,
  });

  const { data: writableCalendars = [] } = useQuery<ConnectedCalendar[]>({
    queryKey: ['calendars-writable'],
    queryFn: async () => (await calendarsApi.writable()).data,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data: SlotTypeFormData) => slotTypesApi.create(buildPayload(data)),
    onSuccess: () => {
      toast.success('Slot created.');
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      setPanelOpen(false);
      setEditTarget(null);
    },
    onError: () => toast.error('Failed to create slot.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SlotTypeFormData }) =>
      slotTypesApi.update(id, buildPayload(data)),
    onSuccess: () => {
      toast.success('Slot updated.');
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      setPanelOpen(false);
      setEditTarget(null);
    },
    onError: () => toast.error('Failed to update slot.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slotTypesApi.delete(id),
    onSuccess: () => {
      toast.success('Slot deleted.');
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete slot.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: SlotType) =>
      slotTypesApi.update(s.id, { ...buildPayload(formFromSlotType(s)), isActive: !s.isActive }),
    // Optimistic: flip the switch immediately, roll back if the server rejects.
    onMutate: async (s) => {
      await queryClient.cancelQueries({ queryKey: ['slot-types'] });
      const prev = queryClient.getQueryData<SlotType[]>(['slot-types']);
      queryClient.setQueryData<SlotType[]>(['slot-types'], (old) =>
        old?.map((st) => (st.id === s.id ? { ...st, isActive: !st.isActive } : st)),
      );
      return { prev };
    },
    onError: (_err, _s, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['slot-types'], ctx.prev);
      toast.error('Failed to update status.');
    },
    onSuccess: (_, s) => {
      toast.success(`Slot ${s.isActive ? 'deactivated' : 'activated'}.`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['slot-types'] }),
  });

  function buildPayload(form: SlotTypeFormData) {
    return {
      ...form,
      workingHoursStart: form.workingHoursStart || null,
      workingHoursEnd: form.workingHoursEnd || null,
      customMeetingLink: form.meetingLinkType === 'custom' ? form.customMeetingLink : null,
    };
  }

  function handleOpenCreate() { setEditTarget(null); setPanelOpen(true); }
  function handleOpenEdit(s: SlotType) { setEditTarget(s); setPanelOpen(true); }
  function handleSave(data: SlotTypeFormData) {
    if (editTarget) { updateMutation.mutate({ id: editTarget.id, data }); }
    else { createMutation.mutate(data); }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink">
        <div>
          <h1 className="font-mono font-bold text-ink text-2xl uppercase tracking-wide">Slots</h1>
          <p className="font-mono text-sm text-emphasis-2 mt-0.5">
            Configure the types of meetings people can book.
          </p>
        </div>
        <button onClick={handleOpenCreate} className={`inline-flex items-center gap-2 ${primaryBtn}`}>
          <i className="hn hn-plus" style={{ fontSize: 14 }} /> Create New
        </button>
      </div>

      {isLoading ? (
        <div className="font-mono text-center py-16 text-emphasis-2 text-sm">Loading…</div>
      ) : slotTypes.length === 0 ? (
        <div className="border border-ink text-center py-16 px-6">
          <i className="hn hn-grid text-emphasis-3 block text-center mb-3" style={{ fontSize: 32 }} />
          <p className="font-mono font-bold text-ink">No slots yet</p>
          <p className="font-mono text-emphasis-2 text-sm mt-1 mb-4">
            Create your first slot to start accepting bookings.
          </p>
          <button onClick={handleOpenCreate} className={`inline-flex items-center gap-2 ${primaryBtn}`}>
            <i className="hn hn-plus" style={{ fontSize: 14 }} /> Create slot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {slotTypes.map((s) => (
            <div
              key={s.id}
              className={`border border-ink p-5 flex flex-col gap-3 ${s.isActive ? '' : 'opacity-60'}`}
            >
              <div className="min-w-0">
                <p className="font-kawingan text-ink truncate">{s.name}</p>
                <p className="font-mono text-sm text-ink">{s.duration} min</p>
              </div>

              {s.description && (
                <p className="font-mono text-sm text-ink line-clamp-2">{s.description}</p>
              )}

              {s.calendar && (
                <p className="font-mono text-sm text-ink">
                  Calendar: <span className="text-ink">{s.calendar.name}</span>
                </p>
              )}

              <div className="font-mono text-sm text-ink flex flex-wrap gap-x-3 gap-y-1">
                <span>Max {s.maxBookingsPerDay}/day</span>
                {s.bufferBefore > 0 && <span>{s.bufferBefore}m before</span>}
                {s.bufferAfter > 0 && <span>{s.bufferAfter}m after</span>}
                {s.meetingLinkType !== 'none' && (
                  <span className="capitalize">{s.meetingLinkType.replace('_', ' ')}</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <PillSwitch checked={s.isActive} onClick={() => toggleMutation.mutate(s)} />
                  <span className="font-mono text-sm text-ink">{s.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => user && copyBookingLink(user.slug, s.slug, user.customDomain)}
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 font-mono text-sm text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
                    title="Copy link"
                  >
                    <i className="hn hn-link" style={{ fontSize: 14 }} /> Copy link
                  </button>
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="inline-flex items-center px-2 py-1.5 text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
                    title="Edit"
                  >
                    <i className="hn hn-pencil" style={{ fontSize: 14, lineHeight: '20px' }} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="inline-flex items-center px-2 py-1.5 text-[#ff0000] border border-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors"
                    title="Delete"
                  >
                    <i className="hn hn-trash" style={{ fontSize: 14, lineHeight: '20px' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit slide-over */}
      <SlideOver
        open={panelOpen}
        title={editTarget ? `Edit: ${editTarget.name}` : 'Create Slot'}
        onClose={() => { setPanelOpen(false); setEditTarget(null); }}
        headerAction={editTarget && user ? (
          <button
            onClick={() => copyBookingLink(user.slug, editTarget.slug, user.customDomain)}
            className="flex items-center gap-1.5 px-2 py-1 font-mono text-sm text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
          >
            <i className="hn hn-link" style={{ fontSize: 14 }} /> Copy link
          </button>
        ) : undefined}
      >
        <SlotTypeForm
          key={editTarget?.id ?? 'new'}
          initial={editTarget ? formFromSlotType(editTarget) : defaultForm}
          writableCalendars={writableCalendars}
          onSave={handleSave}
          onCancel={() => { setPanelOpen(false); setEditTarget(null); }}
          loading={isSaving}
        />
      </SlideOver>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-paper border border-ink max-w-sm w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <i className="hn hn-exclamation-triangle text-[#ff0000] flex-shrink-0 mt-0.5" style={{ fontSize: 16 }} />
              <div>
                <h3 className="font-mono font-bold text-ink">Delete slot?</h3>
                <p className="font-mono text-sm text-emphasis-2 mt-1">
                  "{deleteTarget.name}" will be permanently deleted. Existing bookings will not be
                  affected.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className={secondaryBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-[#ff0000] font-mono text-sm font-bold text-[#ff0000] hover:bg-[#ff0000] hover:text-white transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
