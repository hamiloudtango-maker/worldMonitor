// src/v2/lib/theme.tsx
// Centralized theme system — Dark / Light / Golden
// All components import useTheme() to get current colors.
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface ThemeTokens {
  bgApp: string;
  bgSidebar: string;
  bgCard: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textHeading: string;
  border: string;
  // Extra
  accentHover: string;
  accentMuted: string;   // accent at 15% opacity for backgrounds
  errorBg: string;
  errorBorder: string;
  errorText: string;
}

export type ThemeId = 'dark' | 'light' | 'golden';

const THEMES: Record<ThemeId, ThemeTokens> = {
  dark: {
    bgApp:        '#131d2a',
    bgSidebar:    '#0f1923',
    bgCard:       '#1a2836',
    accent:       '#4d8cf5',
    textPrimary:  '#b0bec9',
    textSecondary:'#6b7d93',
    textHeading:  '#e2e8f0',
    border:       '#1e2d3d',
    accentHover:  '#3a7ae0',
    accentMuted:  '#4d8cf518',
    errorBg:      '#2a1a1a',
    errorBorder:  '#5c2020',
    errorText:    '#f87171',
  },
  light: {
    bgApp:        '#f4f6f9',
    bgSidebar:    '#ffffff',
    bgCard:       '#ffffff',
    accent:       '#4d8cf5',
    textPrimary:  '#374151',
    textSecondary:'#6b7280',
    textHeading:  '#111827',
    border:       '#e5e7eb',
    accentHover:  '#3a7ae0',
    accentMuted:  '#4d8cf512',
    errorBg:      '#fef2f2',
    errorBorder:  '#fecaca',
    errorText:    '#dc2626',
  },
  golden: {
    bgApp:        '#121410',
    bgSidebar:    '#0e100b',
    bgCard:       '#1a1d16',
    accent:       '#d4b85c',
    textPrimary:  '#b8b098',
    textSecondary:'#7a7564',
    textHeading:  '#e8e2cc',
    border:       '#262a1e',
    accentHover:  '#c4a84c',
    accentMuted:  '#d4b85c18',
    errorBg:      '#2a1a1a',
    errorBorder:  '#5c2020',
    errorText:    '#f87171',
  },
};

interface ThemeCtx {
  id: ThemeId;
  t: ThemeTokens;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  id: 'golden',
  t: THEMES.golden,
  setTheme: () => {},
});

const STORAGE_KEY = 'wm-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in THEMES) return saved as ThemeId;
    return 'golden';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, id);
  }, [id]);

  return (
    <ThemeContext.Provider value={{ id, t: THEMES[id], setTheme: setId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { THEMES };
