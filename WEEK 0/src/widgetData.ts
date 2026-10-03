import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Targets } from './plan';

/** What the home screen widget draws from. It never calls Codeforces; the app saves this on every load. */
export type WidgetData = {
  /** The day `target` was worked out for, as Date.toDateString(). */
  day: string;
  /** Today's target, calendar included. On a later day the widget falls back to `targets`. */
  target: number;
  targets: Targets;
  accent: string;
  /** Solves per day, as [Date.toDateString(), count]. */
  solves: [string, number][];
};

const KEY = 'widget';

export const saveWidgetData = (data: WidgetData) => AsyncStorage.setItem(KEY, JSON.stringify(data));

export async function loadWidgetData(): Promise<WidgetData | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as WidgetData) : null;
}
