import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { BookingsPage } from './admin/BookingsPage';
import { SlotTypesPage } from './admin/SlotTypesPage';
import { AvailabilityPage } from './admin/AvailabilityPage';
import { CalendarsPage } from './admin/CalendarsPage';
import { DashboardHome } from './admin/DashboardHome';
import { SettingsPage } from './admin/SettingsPage';

export function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<DashboardHome />} />
      <Route path="bookings" element={<BookingsPage />} />
      <Route path="slot-types" element={<SlotTypesPage />} />
      <Route path="availability" element={<AvailabilityPage />} />
      <Route path="calendars" element={<CalendarsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Routes>
  );
}
