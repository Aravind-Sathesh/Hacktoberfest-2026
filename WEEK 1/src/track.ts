/** A recorded GPS fix. `alt` and `acc` are metres; `t` is epoch ms. */
export type TrackPoint = { lat: number; lng: number; alt: number | null; acc: number | null; t: number };

/** [lat, lng] pairs; what a finished trek keeps for its outline. */
export type Route = [number, number][];

export type TrackStats = { distanceM: number; elevationGainM: number };

// Fixes worse than this are noise under tree cover, not movement
const MAX_ACCURACY_M = 50;
// GPS altitude jitters by a few metres; only count climbs that clear this band
const ELEVATION_STEP_M = 3;

const EARTH_RADIUS_M = 6371000;
// Faster than this between fixes is a GPS jump (a stale first fix, a reflection), not walking or even a bus
const MAX_SPEED_MPS = 30;
// Short hops are always believable; timestamps alone can't judge two fixes taken a moment apart
const ALWAYS_PLAUSIBLE_M = 50;

/** Great-circle distance in metres. */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** One JSON point per line; skips torn or inaccurate lines instead of failing the whole track. */
export function parseTrack(text: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const p = JSON.parse(line) as Partial<TrackPoint>;
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || typeof p.t !== 'number') continue;
      if (typeof p.acc === 'number' && p.acc > MAX_ACCURACY_M) continue;
      points.push({ lat: p.lat, lng: p.lng, alt: p.alt ?? null, acc: p.acc ?? null, t: p.t });
    } catch {
      // A line cut off by the app being killed mid-write
    }
  }
  return points;
}

function plausible(a: TrackPoint, b: TrackPoint): boolean {
  const d = haversine(a.lat, a.lng, b.lat, b.lng);
  const dt = (b.t - a.t) / 1000;
  return d <= ALWAYS_PLAUSIBLE_M || (dt > 0 && d / dt <= MAX_SPEED_MPS);
}

/**
 * Drops GPS jumps: splits the track wherever the implied speed is impossible, then keeps the
 * runs of 3+ points. If nothing is that long yet (a trek just started), the newest run is the best guess.
 */
export function cleanTrack(points: readonly TrackPoint[]): TrackPoint[] {
  const runs: TrackPoint[][] = [];
  for (const p of points) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (run && last && plausible(last, p)) run.push(p);
    else runs.push([p]);
  }
  const kept = runs.filter((r) => r.length >= 3);
  return kept.length > 0 ? kept.flat() : (runs[runs.length - 1] ?? []);
}

export function trackStats(points: readonly TrackPoint[]): TrackStats {
  let distanceM = 0;
  let elevationGainM = 0;
  let base: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const prev = points[i - 1];
    // A gap left by cleanTrack is a jump, not ground covered
    if (prev && plausible(prev, p)) distanceM += haversine(prev.lat, prev.lng, p.lat, p.lng);
    if (p.alt === null) continue;
    if (base === null) base = p.alt;
    else if (p.alt - base >= ELEVATION_STEP_M) {
      elevationGainM += p.alt - base;
      base = p.alt;
    } else if (p.alt < base) base = p.alt;
  }
  return { distanceM, elevationGainM: Math.round(elevationGainM) };
}

/** Length of a drawn or copied route in metres. */
export function routeLength(route: Route): number {
  let m = 0;
  for (let i = 1; i < route.length; i++) m += haversine(...route[i - 1]!, ...route[i]!);
  return m;
}

/** Evenly thins a track to at most `max` points, always keeping both ends. */
export function simplify(points: readonly TrackPoint[], max: number): Route {
  if (points.length <= max) return points.map((p) => [p.lat, p.lng]);
  const step = (points.length - 1) / (max - 1);
  const out: Route = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.round(i * step)]!;
    out.push([p.lat, p.lng]);
  }
  return out;
}

export type Units = 'metric' | 'imperial';

const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

/** "850 m" / "4.2 km", or "420 ft" / "2.6 mi". */
export function formatDistance(m: number, units: Units = 'metric'): string {
  if (units === 'imperial') {
    return m < M_PER_MI / 10 ? `${Math.round(m * FT_PER_M)} ft` : `${(m / M_PER_MI).toFixed(1)} mi`;
  }
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Climb: "540 m" or "1772 ft". */
export function formatElevation(m: number, units: Units = 'metric'): string {
  return units === 'imperial' ? `${Math.round(m * FT_PER_M)} ft` : `${Math.round(m)} m`;
}

/** Minutes per km (or mile), or null when the distance is too short to mean anything. */
export function pace(distanceM: number, ms: number, units: Units = 'metric'): string | null {
  if (distanceM < 100 || ms <= 0) return null;
  const unitM = units === 'imperial' ? M_PER_MI : 1000;
  const perUnit = ms / 60000 / (distanceM / unitM);
  const m = Math.floor(perUnit);
  const s = Math.round((perUnit - m) * 60);
  const suffix = units === 'imperial' ? '/mi' : '/km';
  return s === 60 ? `${m + 1}:00 ${suffix}` : `${m}:${String(s).padStart(2, '0')} ${suffix}`;
}

export type Projector = (lat: number, lng: number) => { x: number; y: number };

/**
 * Fits a route into a w×h box (keeping its shape) for drawing.
 * Equirectangular with a cos(lat) correction is plenty at hike scale.
 */
export function fitRoute(route: Route, w: number, h: number, pad: number): Projector {
  if (route.length === 0) return () => ({ x: w / 2, y: h / 2 });
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * kx;
  const spanY = maxLat - minLat;
  const span = Math.max(spanX, spanY);
  const scale = span === 0 ? 0 : Math.min((w - 2 * pad) / (spanX || span), (h - 2 * pad) / (spanY || span));
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return (lat, lng) => ({ x: offX + (lng - minLng) * kx * scale, y: offY + (maxLat - lat) * scale });
}

/** SVG path data for a projected route. */
export function routePath(route: Route, project: Projector): string {
  return route
    .map(([lat, lng], i) => {
      const { x, y } = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Stopwatch reading: "4:05" under an hour, "1:04:05" after. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** [west, south, east, north] around a route, padded by `padM` metres so the trail isn't at the edge. */
export function routeBounds(route: Route, padM: number): [number, number, number, number] | null {
  if (route.length === 0) return null;
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = padM / 111320;
  const dLng = padM / (111320 * Math.cos((midLat * Math.PI) / 180));
  return [Math.min(...lngs) - dLng, Math.min(...lats) - dLat, Math.max(...lngs) + dLng, Math.max(...lats) + dLat];
}

/** Metres from a point to the nearest part of a route (its segments, not just its points). */
export function distanceToRoute(lat: number, lng: number, route: Route): number {
  if (route.length === 0) return Infinity;
  // Flat metres around the point; plenty accurate at trail scale
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 111320;
  let best = Infinity;
  for (let i = 0; i < route.length; i++) {
    const [aLat, aLng] = route[i]!;
    const ax = (aLng - lng) * kx;
    const ay = (aLat - lat) * ky;
    const next = route[i + 1];
    if (!next) {
      best = Math.min(best, Math.hypot(ax, ay));
      continue;
    }
    const bx = (next[1] - lng) * kx;
    const by = (next[0] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// Off once two fixes in a row are this far out; back on only when clearly near again, so
// GPS wobble around the edge doesn't flip the alert on and off
export const OFF_ROUTE_M = 60;
const BACK_ON_ROUTE_M = 35;

/** Whether the hiker has left the planned route, given their latest fixes and the previous answer. */
export function isOffRoute(points: readonly TrackPoint[], planned: Route, wasOff: boolean): boolean {
  if (planned.length < 2 || points.length === 0) return false;
  const last = points[points.length - 1]!;
  const d = distanceToRoute(last.lat, last.lng, planned);
  if (wasOff) return d > BACK_ON_ROUTE_M;
  const prev = points[points.length - 2];
  return d > OFF_ROUTE_M && prev !== undefined && distanceToRoute(prev.lat, prev.lng, planned) > OFF_ROUTE_M;
}
