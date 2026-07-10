import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const authApi = {
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const calendarsApi = {
  list: () => api.get('/calendars'),
  writable: () => api.get('/calendars/writable'),
  sync: () => api.post('/calendars/sync'),
  disconnect: (calendarId: string) => api.delete(`/calendars/${encodeURIComponent(calendarId)}`),
  listGoogleAccounts: () => api.get('/calendars/google-accounts'),
  disconnectGoogleAccount: (accountId: string) => api.delete(`/calendars/google-accounts/${accountId}`),
  connectInitToken: () => api.post('/auth/google/connect-init'),
};

export const slotTypesApi = {
  list: () => api.get('/slot-types'),
  getOne: (id: string) => api.get(`/slot-types/${id}`),
  getPublic: (id: string) => api.get(`/slot-types/public/${id}`),
  getUserPublic: (slug: string) => api.get(`/slot-types/user/${slug}`),
  getBySlug: (userSlug: string, slotSlug: string) => api.get(`/slot-types/user/${userSlug}/${slotSlug}`),
  getByDomain: (host: string) => api.get('/slot-types/by-domain', { params: { host } }),
  create: (data: any) => api.post('/slot-types', data),
  update: (id: string, data: any) => api.put(`/slot-types/${id}`, data),
  delete: (id: string) => api.delete(`/slot-types/${id}`),
};

export const workingHoursApi = {
  get: () => api.get('/working-hours'),
  update: (hours: any[]) => api.put('/working-hours', { hours }),
  getBreaks: () => api.get('/working-hours/breaks'),
  upsertBreak: (data: any) => api.post('/working-hours/breaks', data),
  deleteBreak: (id: string) => api.delete(`/working-hours/breaks/${id}`),
  getHolidays: () => api.get('/working-hours/holidays'),
  upsertHoliday: (data: any) => api.post('/working-hours/holidays', data),
  deleteHoliday: (id: string) => api.delete(`/working-hours/holidays/${id}`),
};

export const availabilityApi = {
  get: (userId: string, slotTypeId: string, from: string, to: string, tz: string) =>
    api.get(`/availability/${userId}/${slotTypeId}`, { params: { from, to, tz } }),
  lock: (data: { userId: string; slotTypeId: string; startTime: string }) =>
    api.post('/availability/lock', data),
  unlock: (lockId: string) => api.post(`/availability/unlock/${lockId}`),
};

export const bookingsApi = {
  create: (data: any) => api.post('/bookings', data),
  list: (status?: string) => api.get('/bookings', { params: status ? { status } : {} }),
  adminCancel: (id: string) => api.delete(`/bookings/${id}`),
  cancel: (token: string, reason?: string) => api.post(`/bookings/cancel/${token}`, { reason }),
  reschedule: (token: string, startTime: string) =>
    api.post(`/bookings/reschedule/${token}`, { startTime }),
  getByToken: (token: string, type: 'cancel' | 'reschedule') =>
    api.get(`/bookings/by-token/${token}`, { params: { type } }),
};

export const usersApi = {
  getProfile: () => api.get('/users/profile'),
  updateTimezone: (timezone: string) => api.put('/users/timezone', { timezone }),
  updatePrimaryCalendar: (calendarId: string) => api.put('/users/primary-calendar', { calendarId }),
  updateSlug: (slug: string) => api.put('/users/slug', { slug }),
  updateCustomDomain: (domain: string | null) => api.put('/users/custom-domain', { domain }),
  updateEmailPrefs: (prefs: { notifyOnBooking?: boolean; sendReminders?: boolean; reminderHours?: number }) =>
    api.put('/users/email-prefs', prefs),
  updateThemePrefs: (prefs: { theme?: string; applyThemeToAdmin?: boolean; applyThemeToBooking?: boolean }) =>
    api.put('/users/theme-prefs', prefs),
};

export default api;
