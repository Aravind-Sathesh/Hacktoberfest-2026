import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';

// Neutral greys so the accent (and the danger colours) carry all the colour
export const palette = {
  light: {
    background: '#F4F4F1',
    surface: '#FFFFFF',
    text: '#1C1F23',
    muted: '#5F656D',
    border: '#E1E1DC',
    accent: '#1D4ED8',
    onAccent: '#FFFFFF',
    harmless: '#2E7D32',
    caution: '#8A5300',
    dangerous: '#C62828',
  },
  dark: {
    background: '#0E1013',
    surface: '#171A1F',
    text: '#E8EAED',
    muted: '#9BA1A8',
    border: '#262A30',
    accent: '#7AA7FF',
    onAccent: '#0E1013',
    harmless: '#66BB6A',
    caution: '#FFB74D',
    dangerous: '#EF5350',
  },
} as const;

export type ThemeColors = { readonly [K in keyof typeof palette.light]: string };

export type AccentId = 'lake' | 'glacier' | 'dusk' | 'moss';

// No reds or ambers: those mean caution and danger here
export const ACCENTS: Record<AccentId, { label: string; light: string; dark: string }> = {
  lake: { label: 'Lake', light: '#1D4ED8', dark: '#7AA7FF' },
  glacier: { label: 'Glacier', light: '#0F766E', dark: '#5EC8BD' },
  dusk: { label: 'Dusk', light: '#6D28D9', dark: '#B39DFF' },
  moss: { label: 'Moss', light: '#2F6B3A', dark: '#6FBF7A' },
};

export const fonts = {
  regular: 'Inter_400Regular',
  italic: 'Inter_400Regular_Italic',
  semibold: 'Inter_600SemiBold',
} as const;

export type TypeSize = 13 | 15 | 18 | 28;

export const radius = {
  card: 20,
  pill: 999,
} as const;

export type Theme = { readonly colors: ThemeColors; readonly isDark: boolean };

/** Dark by default; Profile can switch to light or follow the phone. Overrides useColorScheme app-wide. */
export function applyTheme(pref: 'dark' | 'light' | 'system'): void {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

// Before saved settings load, so the first frame is already dark
applyTheme('dark');

// The accent lives outside React state so every useTheme() caller re-renders when it changes
let accent: AccentId = 'lake';
const listeners = new Set<() => void>();

export function applyAccent(next: AccentId): void {
  if (next === accent) return;
  accent = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark';
  const id = useSyncExternalStore(subscribe, () => accent);
  const base = isDark ? palette.dark : palette.light;
  return { colors: { ...base, accent: ACCENTS[id][isDark ? 'dark' : 'light'] }, isDark };
}

/** `#RRGGBB` plus an alpha percentage, for tinted backgrounds. */
export function tint(hex: string, percent: number): string {
  return hex + Math.round((percent / 100) * 255).toString(16).padStart(2, '0');
}
