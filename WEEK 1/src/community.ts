import { haversine, type Route, type Units } from './track';
import type { Sighting, Trek } from './treks';
import type { DangerLevel } from './ui';

export type SortBy = 'nearest' | 'newest' | 'shortest' | 'longest' | 'flattest';

/** Each filter is an inclusive [min, max) band; null means "any". */
export type Band = { min: number; max: number } | null;

export type PostFilters = {
  sort: SortBy;
  /** Maximum metres from you to the route's start. */
  within: number | null;
  distance: Band;
  /** Moving time in minutes. */
  minutes: Band;
  climb: Band;
};

export const DEFAULT_FILTERS: PostFilters = { sort: 'newest', within: null, distance: null, minutes: null, climb: null };

export type Here = { lat: number; lng: number } | null;

/** Metres from here to where the route starts; null when either is unknown. */
export function distanceFrom(post: Trek, here: Here): number | null {
  const start = post.route[0];
  return here && start ? haversine(here.lat, here.lng, start[0], start[1]) : null;
}

const inBand = (v: number, band: Band) => band === null || (v >= band.min && v < band.max);
const minutesOf = (t: Trek) => ((t.endedAt ?? 0) - (t.startedAt ?? 0)) / 60000;

/**
 * Filters then sorts. Without a location, "nearest" falls back to newest and the proximity
 * filter is skipped rather than hiding everything.
 */
export function applyFilters(posts: readonly Trek[], f: PostFilters, here: Here): Trek[] {
  const kept = posts.filter((p) => {
    const away = distanceFrom(p, here);
    if (f.within !== null && away !== null && away > f.within) return false;
    return inBand(p.distanceM, f.distance) && inBand(minutesOf(p), f.minutes) && inBand(p.elevationGainM, f.climb);
  });
  const by: Record<SortBy, (a: Trek, b: Trek) => number> = {
    nearest: (a, b) => (distanceFrom(a, here) ?? Infinity) - (distanceFrom(b, here) ?? Infinity),
    newest: (a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0),
    shortest: (a, b) => a.distanceM - b.distanceM,
    longest: (a, b) => b.distanceM - a.distanceM,
    flattest: (a, b) => a.elevationGainM - b.elevationGainM,
  };
  const sort = f.sort === 'nearest' && !here ? 'newest' : f.sort;
  return kept.sort(by[sort]);
}

/** How many filters (not the sort) are narrowing the list, for the button badge. */
export function activeCount(f: PostFilters): number {
  return [f.within, f.distance, f.minutes, f.climb].filter((v) => v !== null).length;
}

const M_PER_MI = 1609.344;
const M_PER_FT = 0.3048;

export type Step<T> = { label: string; value: T };

/** Proximity steps in round numbers of the user's units. */
export function proximitySteps(units: Units): Step<number | null>[] {
  const [unit, label] = units === 'imperial' ? [M_PER_MI, 'mi'] : [1000, 'km'];
  return [
    { label: 'Anywhere', value: null },
    ...[5, 25, 100].map((n) => ({ label: `Within ${n} ${label}`, value: n * unit })),
  ];
}

/** Length bands: short / medium / long, in round numbers of the user's units. */
export function distanceSteps(units: Units): Step<Band>[] {
  const [unit, label] = units === 'imperial' ? [M_PER_MI, 'mi'] : [1000, 'km'];
  const [a, b] = units === 'imperial' ? [3, 6] : [5, 10];
  return [
    { label: 'Any length', value: null },
    { label: `Under ${a} ${label}`, value: { min: 0, max: a * unit } },
    { label: `${a}–${b} ${label}`, value: { min: a * unit, max: b * unit } },
    { label: `Over ${b} ${label}`, value: { min: b * unit, max: Infinity } },
  ];
}

export const TIME_STEPS: Step<Band>[] = [
  { label: 'Any time', value: null },
  { label: 'Under 2 h', value: { min: 0, max: 120 } },
  { label: '2–4 h', value: { min: 120, max: 240 } },
  { label: 'Over 4 h', value: { min: 240, max: Infinity } },
];

export function climbSteps(units: Units): Step<Band>[] {
  const [unit, label, a, b] = units === 'imperial' ? [M_PER_FT, 'ft', 1000, 2500] : [1, 'm', 300, 800];
  return [
    { label: 'Any climb', value: null },
    { label: `Under ${a} ${label}`, value: { min: 0, max: a * unit } },
    { label: `${a}–${b} ${label}`, value: { min: a * unit, max: b * unit } },
    { label: `Over ${b} ${label}`, value: { min: b * unit, max: Infinity } },
  ];
}

export const SORTS: Step<SortBy>[] = [
  { label: 'Nearest', value: 'nearest' },
  { label: 'Newest', value: 'newest' },
  { label: 'Shortest', value: 'shortest' },
  { label: 'Longest', value: 'longest' },
  { label: 'Least climbing', value: 'flattest' },
];

/** A row in the Supabase `posts` table (supabase/schema.sql). */
export type PostRow = {
  id?: string;
  user_id?: string;
  local_id: string;
  author: string;
  title: string;
  started_at: string;
  ended_at: string;
  distance_m: number;
  elevation_gain_m: number;
  route: Route;
  avatar_url?: string | null;
  sightings: { kind: Sighting['kind']; label: string; danger: DangerLevel; lat: number | null; lng: number | null; taken_at: number }[];
};

/** What leaves the phone when you post: route, totals and species. Never photos. */
export function toRow(trek: Trek, author: string): PostRow {
  return {
    local_id: trek.id,
    author: author.slice(0, 30),
    title: trek.title.slice(0, 60),
    started_at: new Date(trek.startedAt ?? 0).toISOString(),
    ended_at: new Date(trek.endedAt ?? trek.startedAt ?? 0).toISOString(),
    distance_m: trek.distanceM,
    elevation_gain_m: trek.elevationGainM,
    route: trek.route,
    sightings: trek.sightings.map((s) => ({
      kind: s.kind,
      label: s.label,
      danger: s.danger,
      lat: s.lat,
      lng: s.lng,
      taken_at: s.takenAt,
    })),
  };
}

/** Someone's post, shaped like a trek so the same cards and filters work on it. */
export function fromRow(row: PostRow): Trek {
  return {
    id: `post-${row.id ?? row.local_id}`,
    title: row.title,
    status: 'done',
    plannedFor: null,
    startedAt: Date.parse(row.started_at),
    endedAt: Date.parse(row.ended_at),
    gear: [],
    sightings: row.sightings.map((s) => ({
      kind: s.kind,
      photoUri: '',
      label: s.label,
      danger: s.danger,
      takenAt: s.taken_at,
      lat: s.lat,
      lng: s.lng,
    })),
    sample: false,
    author: row.author,
    authorAvatar: row.avatar_url ?? null,
    shared: true,
    plannedRoute: [],
    route: row.route,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
  };
}
