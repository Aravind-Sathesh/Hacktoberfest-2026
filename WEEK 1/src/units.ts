import { useSyncExternalStore } from 'react';
import type { Units } from './track';

// Like the accent: outside React state so any screen can format distances without prop drilling
let units: Units = 'metric';
const listeners = new Set<() => void>();

export function applyUnits(next: Units): void {
  if (next === units) return;
  units = next;
  listeners.forEach((l) => l());
}

export function useUnits(): Units {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => units,
  );
}
