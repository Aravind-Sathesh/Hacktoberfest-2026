import { routeLength, type Route, type TrackStats, type Units } from './track';
import type { AccentId } from './theme';
import type { DangerLevel } from './ui';

export type Experience = 'new' | 'regular' | 'seasoned';

export type Profile = {
  name: string;
  experience: Experience;
  emergencyNumber: string;
  contact: { name: string; phone: string } | null;
  /** Profile photo on this phone, and its uploaded copy shown on your posts. */
  photoUri: string | null;
  avatarUrl: string | null;
};

export type Sighting = {
  /** A species identified for safety, or a view worth remembering (no identification). */
  kind: 'species' | 'scenery';
  photoUri: string;
  label: string;
  danger: DangerLevel;
  takenAt: number;
  lat: number | null;
  lng: number | null;
};

export type GearItem = {
  name: string;
  packed: boolean;
};

export type Trek = {
  id: string;
  title: string;
  status: 'planned' | 'active' | 'done';
  plannedFor: string | null; // YYYY-MM-DD
  startedAt: number | null;
  endedAt: number | null;
  gear: GearItem[];
  sightings: Sighting[];
  /** Ships with the app as demo content; never stored. */
  sample: boolean;
  /** Who posted it; null is you. */
  author: string | null;
  /** The poster's profile photo (other people's posts only). */
  authorAvatar?: string | null;
  /** Treks are private until you post them to Community. */
  shared: boolean;
  /** The route you meant to follow, e.g. copied from a Community post. */
  plannedRoute: Route;
  /** What you actually walked: a thinned outline, filled in when the trek ends. */
  route: Route;
  distanceM: number;
  elevationGainM: number;
};

export type ThemePref = 'dark' | 'light' | 'system';

export type Checklist = { id: string; name: string; items: string[] };

export type AppState = {
  profile: Profile | null;
  treks: Trek[];
  theme: ThemePref;
  accent: AccentId;
  units: Units;
  checklists: Checklist[];
};

/** The 10 survival checklist items from IDEA.md in exact order. */
export const GEAR_CHECKLIST: readonly string[] = [
  'Water',
  'Fire starter',
  'Light',
  'First aid',
  'Navigation',
  'Shelter',
  'Food',
  'Tools',
  'Sun protection',
  'Insulation',
];

export const DEFAULT_CHECKLISTS: Checklist[] = [{ id: 'essentials', name: 'Ten essentials', items: [...GEAR_CHECKLIST] }];

export const EMPTY_STATE: AppState = {
  profile: null,
  treks: [],
  theme: 'dark',
  accent: 'lake',
  units: 'metric',
  checklists: DEFAULT_CHECKLISTS,
};

/** Creates a planned trek with String(now) as the id. */
export function planTrek(
  title: string,
  plannedFor: string | null,
  gear: GearItem[],
  now: number,
  plannedRoute: Route = [],
): Trek {
  return {
    id: String(now),
    title,
    status: 'planned',
    plannedFor,
    startedAt: null,
    endedAt: null,
    gear,
    sightings: [],
    sample: false,
    author: null,
    shared: false,
    plannedRoute,
    route: [],
    // Until the trek is walked, its distance is the plan's
    distanceM: routeLength(plannedRoute),
    elevationGainM: 0,
  };
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatDayMonth(now: number): string {
  const d = new Date(now);
  const day = d.getDate();
  const month = SHORT_MONTHS[d.getMonth()] ?? '';
  return `${day} ${month}`;
}

/**
 * Turns a planned trek active (by id, keeping what was packed) or creates an impromptu trek (if trekId is null).
 * At most one active trek: returns state unchanged if one is already active.
 */
export function startTrek(state: AppState, trekId: string | null, now: number, gear?: GearItem[]): AppState {
  if (state.treks.some((t) => t.status === 'active')) {
    return state;
  }

  if (trekId !== null) {
    const nextTreks = state.treks.map((t) =>
      t.id === trekId
        ? {
            ...t,
            status: 'active' as const,
            startedAt: now,
            // What was actually ticked off on the pre-start checklist
            gear: gear ?? t.gear,
          }
        : t,
    );
    return { ...state, treks: nextTreks };
  }

  const impromptu: Trek = {
    id: String(now),
    title: `Trek on ${formatDayMonth(now)}`,
    status: 'active',
    plannedFor: null,
    startedAt: now,
    endedAt: null,
    gear: [],
    sightings: [],
    sample: false,
    author: null,
    shared: false,
    plannedRoute: [],
    route: [],
    distanceM: 0,
    elevationGainM: 0,
  };

  return {
    ...state,
    treks: [impromptu, ...state.treks],
  };
}

/** Ends the active trek, keeping its outline and totals. If none is active, returns state unchanged. */
export function endTrek(state: AppState, now: number, stats: TrackStats, route: Route): AppState {
  if (!state.treks.some((t) => t.status === 'active')) {
    return state;
  }
  const nextTreks = state.treks.map((t) =>
    t.status === 'active'
      ? {
          ...t,
          status: 'done' as const,
          endedAt: now,
          route,
          distanceM: stats.distanceM,
          elevationGainM: stats.elevationGainM,
        }
      : t,
  );
  return { ...state, treks: nextTreks };
}

/** Posts a finished trek to Community, or takes it back. */
export function setShared(state: AppState, trekId: string, shared: boolean): AppState {
  return { ...state, treks: state.treks.map((t) => (t.id === trekId && t.status === 'done' ? { ...t, shared } : t)) };
}

/** Appends a sighting to the active trek. Does nothing if there is none. */
export function addSighting(state: AppState, sighting: Sighting): AppState {
  if (!state.treks.some((t) => t.status === 'active')) {
    return state;
  }
  const nextTreks = state.treks.map((t) =>
    t.status === 'active'
      ? {
          ...t,
          sightings: [...t.sightings, sighting],
        }
      : t,
  );
  return { ...state, treks: nextTreks };
}

/**
 * Sorts treks for the feed:
 * 1. Active first
 * 2. Planned by plannedFor ascending (nulls last)
 * 3. Done by endedAt descending (highest timestamp first)
 */
export function feed(treks: readonly Trek[]): Trek[] {
  const active = treks.filter((t) => t.status === 'active');
  const planned = treks
    .filter((t) => t.status === 'planned')
    .sort((a, b) => {
      if (!a.plannedFor) return 1;
      if (!b.plannedFor) return -1;
      return a.plannedFor.localeCompare(b.plannedFor);
    });
  const done = treks
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));

  return [...active, ...planned, ...done];
}

/**
 * Formats duration between startedAt and endedAt into "45 min" or "2 h 10 min".
 */
export function duration(startedAt: number | null, endedAt: number | null): string {
  if (startedAt === null || endedAt === null || endedAt <= startedAt) {
    return '0 min';
  }
  const diffMinutes = Math.floor((endedAt - startedAt) / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${mins} min`;
}

export type DayOption = {
  readonly iso: string;
  readonly label: string;
};

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Returns the next N days starting from `now`:
 * [{ iso: '2026-10-08', label: 'Today' }, { iso: '2026-10-09', label: 'Tomorrow' }, { iso: '2026-10-10', label: 'Sat 10' }, ...]
 */
export function nextDays(now: number, count = 7): DayOption[] {
  const result: DayOption[] = [];
  const base = new Date(now);

  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    let label: string;
    if (i === 0) {
      label = 'Today';
    } else if (i === 1) {
      label = 'Tomorrow';
    } else {
      const weekday = SHORT_WEEKDAYS[d.getDay()] ?? '';
      label = `${weekday} ${d.getDate()}`;
    }
    result.push({ iso, label });
  }

  return result;
}

/**
 * Validates phone numbers: 2–15 digits, with an optional leading + and spaces allowed.
 */
export function isValidPhone(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  // Must only contain optional leading +, digits, and spaces
  if (!/^\+?[\d\s]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 2 && digits.length <= 15;
}

function toProfile(obj: unknown): Profile | null {
  if (!obj || typeof obj !== 'object') return null;
  const p = obj as Record<string, unknown>;
  if (typeof p.name !== 'string' || typeof p.emergencyNumber !== 'string') return null;
  if (p.experience !== 'new' && p.experience !== 'regular' && p.experience !== 'seasoned') return null;
  let contact: Profile['contact'] = null;
  if (p.contact !== null && p.contact !== undefined) {
    const c = p.contact as Record<string, unknown>;
    if (typeof c !== 'object' || typeof c.name !== 'string' || typeof c.phone !== 'string') return null;
    contact = { name: c.name, phone: c.phone };
  }
  return {
    name: p.name,
    experience: p.experience,
    emergencyNumber: p.emergencyNumber,
    contact,
    // Older saves had no photo
    photoUri: typeof p.photoUri === 'string' ? p.photoUri : null,
    avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null,
  };
}

const ACCENT_IDS: readonly AccentId[] = ['lake', 'glacier', 'dusk', 'moss'];

function isChecklist(obj: unknown): obj is Checklist {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    Array.isArray(c.items) &&
    c.items.every((i) => typeof i === 'string')
  );
}

function isGearItem(obj: unknown): obj is GearItem {
  if (!obj || typeof obj !== 'object') return false;
  const g = obj as Record<string, unknown>;
  return typeof g.name === 'string' && typeof g.packed === 'boolean';
}

const DANGER_LEVELS: readonly string[] = ['harmless', 'caution', 'dangerous', 'uncertain'];

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toSighting(obj: unknown): Sighting | null {
  if (!obj || typeof obj !== 'object') return null;
  const s = obj as Record<string, unknown>;
  const takenAt = num(s.takenAt);
  if (typeof s.photoUri !== 'string' || typeof s.label !== 'string' || takenAt === null) return null;
  const danger = (DANGER_LEVELS.includes(String(s.danger)) ? s.danger : 'uncertain') as DangerLevel;
  const kind = s.kind === 'scenery' ? 'scenery' : 'species';
  return { kind, photoUri: s.photoUri, label: s.label, danger, takenAt, lat: num(s.lat), lng: num(s.lng) };
}

function toRoute(v: unknown): Route {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is [number, number] => Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null,
  );
}

/** Validates one stored trek, filling fields older saves didn't have. */
function toTrek(obj: unknown): Trek | null {
  if (!obj || typeof obj !== 'object') return null;
  const t = obj as Record<string, unknown>;
  if (
    typeof t.id !== 'string' ||
    typeof t.title !== 'string' ||
    (t.status !== 'planned' && t.status !== 'active' && t.status !== 'done') ||
    !Array.isArray(t.gear) ||
    !Array.isArray(t.sightings)
  ) {
    return null;
  }
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    plannedFor: typeof t.plannedFor === 'string' ? t.plannedFor : null,
    startedAt: num(t.startedAt),
    endedAt: num(t.endedAt),
    gear: t.gear.filter(isGearItem),
    sightings: t.sightings.map(toSighting).filter((s): s is Sighting => s !== null),
    sample: false,
    author: null,
    shared: t.shared === true,
    plannedRoute: toRoute(t.plannedRoute),
    route: toRoute(t.route),
    distanceM: num(t.distanceM) ?? 0,
    elevationGainM: num(t.elevationGainM) ?? 0,
  };
}

/**
 * Parses the saved state, or null when the file is unreadable (so the caller can keep it instead of
 * overwriting it). Samples are never stored (they ship with the app), so stored ones are dropped.
 */
export function parseState(json: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    const theme: ThemePref = p.theme === 'light' || p.theme === 'system' ? p.theme : 'dark';
    const accent: AccentId = ACCENT_IDS.includes(p.accent as AccentId) ? (p.accent as AccentId) : 'lake';
    const checklists = Array.isArray(p.checklists) ? p.checklists.filter(isChecklist) : [];
    const treks = Array.isArray(p.treks)
      ? p.treks.filter((t) => !(t && typeof t === 'object' && (t as Trek).sample)).map(toTrek)
      : [];
    return {
      profile: toProfile(p.profile),
      treks: treks.filter((t): t is Trek => t !== null),
      theme,
      accent,
      units: p.units === 'imperial' ? 'imperial' : 'metric',
      checklists: checklists.length > 0 ? checklists : DEFAULT_CHECKLISTS,
    };
  } catch {
    return null;
  }
}

/** Each species once (first sighting wins), plus how many of those are dangerous. Scenery isn't a species. */
export function speciesSummary(sightings: readonly Sighting[]): { species: Sighting[]; dangerous: number } {
  const seen = new Set<string>();
  const species = sightings.filter((s) => s.kind === 'species' && !seen.has(s.label) && seen.add(s.label));
  return { species, dangerous: species.filter((s) => s.danger === 'dangerous').length };
}
