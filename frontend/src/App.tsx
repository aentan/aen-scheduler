import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PageLoader } from './components/shared/LoadingSpinner';
import { AdminLayout } from './components/shared/Layout';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { PublicBookingPage } from './pages/PublicBookingPage';
import { CustomDomainBookingPage } from './pages/CustomDomainBookingPage';
import { BookingLandingPage } from './pages/BookingLandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CancelBookingPage } from './pages/CancelBookingPage';
import { RescheduleBookingPage } from './pages/RescheduleBookingPage';

const APP_HOST = import.meta.env.VITE_APP_HOST || 'localhost';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      refreshUser().then(() => navigate('/admin'));
    } else {
      navigate('/login');
    }
  }, []);

  return <PageLoader />;
}

function ThemeSyncer() {
  const { user } = useAuth();
  const { setThemePrefs } = useTheme();
  // Sync server prefs to local state once per login. Continuous syncing would
  // revert optimistic switch toggles whenever the user object refetches.
  const syncedUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;
    setThemePrefs({
      theme: user.theme ?? 'system',
      applyThemeToAdmin: user.applyThemeToAdmin ?? true,
      applyThemeToBooking: user.applyThemeToBooking ?? false,
    });
  }, [user]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function isCustomDomain(): boolean {
  const h = window.location.hostname;
  return h !== APP_HOST && h !== 'localhost' && h !== '127.0.0.1' && !h.endsWith(APP_HOST);
}

function AppRoutes() {
  if (isCustomDomain()) {
    return (
      <Routes>
        <Route path="/cancel/:token" element={<CancelBookingPage />} />
        <Route path="/reschedule/:token" element={<RescheduleBookingPage />} />
        <Route path="/" element={<BookingLandingPage />} />
        <Route path="/:slotSlug" element={<CustomDomainBookingPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/cancel/:token" element={<CancelBookingPage />} />
      <Route path="/reschedule/:token" element={<RescheduleBookingPage />} />
      <Route path="/book/:slug" element={<BookingLandingPage />} />
      <Route path="/book/:slug/:slotSlug" element={<PublicBookingPage />} />
      <Route path="/admin/*" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider surface="admin">
            <ThemeSyncer />
            <AppRoutes />
            <Toaster position="top-right" />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
