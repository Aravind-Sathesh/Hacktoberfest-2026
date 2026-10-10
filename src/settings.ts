import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Targets } from './plan';

/** Where the day's suggestions come from: TLE's CP-31 sheet in order, or any problem near his rating. */
export type ProblemSource = 'cp31' | 'rating';

export type Settings = {
  handle: string;
  goalRating: number;
  /** YYYY-MM-DD */
  goalDate: string;
  accent: string;
  /** Tags hint at the approach, so they're hidden unless he wants them. */
  showTags: boolean;
  /** Some people solve better not knowing how hard it's supposed to be. */
  showRatings: boolean;
  /** Problems with any of these tags are never picked. */
  excludedTags: string[];
  problemSource: ProblemSource;
  /** Pick problems as if he were this rating, e.g. to move on to the next sheet. Null means his real progress. */
  practiceRating: number | null;
  targets: Targets;
};

export const ACCENTS = ['#38bdf8', '#4ade80', '#f472b6', '#facc15', '#fb923c', '#a78bfa'];

export const DEFAULT_SETTINGS: Settings = {
  handle: '',
  goalRating: 1800,
  goalDate: `${new Date().getFullYear()}-12-31`,
  accent: ACCENTS[0],
  showTags: false,
  showRatings: true,
  excludedTags: [],
  problemSource: 'cp31',
  practiceRating: null,
  targets: {
    weekday: { problems: 4, minutes: 150 },
    weekend: { problems: 6, minutes: 240 },
  },
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
}

export const saveSettings = (settings: Settings) => AsyncStorage.setItem(KEY, JSON.stringify(settings));

export const daysUntil = (goalDate: string, now: Date) =>
  Math.max(0, Math.ceil((new Date(`${goalDate}T23:59:59`).getTime() - now.getTime()) / 86_400_000));
