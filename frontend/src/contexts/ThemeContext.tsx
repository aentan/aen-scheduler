import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  applyThemeToAdmin: boolean;
  applyThemeToBooking: boolean;
  setThemePrefs: (prefs: { theme?: Theme; applyThemeToAdmin?: boolean; applyThemeToBooking?: boolean }) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark', target: 'admin' | 'booking' | 'none') {
  const root = document.documentElement;
  if (target === 'none') {
    root.classList.remove('dark');
  } else {
    resolved === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
  }
}

export function ThemeProvider({
  children,
  surface,
}: {
  children: React.ReactNode;
  surface: 'admin' | 'booking';
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });
  const [applyThemeToAdmin, setApplyThemeToAdmin] = useState(() => {
    return localStorage.getItem('applyThemeToAdmin') !== 'false';
  });
  const [applyThemeToBooking, setApplyThemeToBooking] = useState(() => {
    return localStorage.getItem('applyThemeToBooking') === 'true';
  });

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  const applies = surface === 'admin' ? applyThemeToAdmin : applyThemeToBooking;

  // Only manage the global `dark` class on admin routes. Public booking pages
  // own the class themselves (driven by the slot owner's prefs); touching it
  // here races with them and the loser's state wins.
  const { pathname } = useLocation();
  const ownsRoute =
    surface !== 'admin' || pathname.startsWith('/admin') || pathname === '/login';

  useEffect(() => {
    if (!ownsRoute) return;
    applyTheme(resolvedTheme, applies ? surface : 'none');
  }, [resolvedTheme, applies, surface, ownsRoute]);

  useEffect(() => {
    if (!ownsRoute || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(getSystemTheme(), applies ? surface : 'none');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applies, surface, ownsRoute]);

  const setThemePrefs: ThemeContextValue['setThemePrefs'] = (prefs) => {
    if (prefs.theme !== undefined) {
      setTheme(prefs.theme);
      localStorage.setItem('theme', prefs.theme);
    }
    if (prefs.applyThemeToAdmin !== undefined) {
      setApplyThemeToAdmin(prefs.applyThemeToAdmin);
      localStorage.setItem('applyThemeToAdmin', String(prefs.applyThemeToAdmin));
    }
    if (prefs.applyThemeToBooking !== undefined) {
      setApplyThemeToBooking(prefs.applyThemeToBooking);
      localStorage.setItem('applyThemeToBooking', String(prefs.applyThemeToBooking));
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, applyThemeToAdmin, applyThemeToBooking, setThemePrefs, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
