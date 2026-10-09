import { routeLength, type Route } from './track';
import type { Sighting, Trek } from './treks';
import type { DangerLevel } from './ui';

// Sample Community posts ship with the app so the feed isn't empty. Authors are made up, and routes
// are generated shapes at made-up coordinates, never a recorded track (AGENTS.md: no real GPS).

const BASE = new Date('2026-10-08T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/** A smooth winding trail: `n` steps of ~`stepM` metres with a heading that drifts by `turn(i)`. */
function trail(lat: number, lng: number, n: number, stepM: number, turn: (i: number) => number): Route {
  const out: Route = [[lat, lng]];
  let heading = 0;
  for (let i = 1; i < n; i++) {
    heading += turn(i);
    lat += (stepM * Math.cos(heading)) / 111320;
    lng += (stepM * Math.sin(heading)) / (111320 * Math.cos((lat * Math.PI) / 180));
    out.push([lat, lng]);
  }
  return out;
}

/** A wobbly loop that ends where it started. */
function loop(lat: number, lng: number, n: number, radiusM: number): Route {
  const out: Route = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const r = radiusM * (1 + 0.18 * Math.sin(3 * a) + 0.08 * Math.cos(5 * a));
    out.push([lat + (r * Math.cos(a)) / 111320, lng + (1.6 * r * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180))]);
  }
  return out;
}

/** A Community post shipped as a sample; sightings are spread along the route as checkpoints. */
function post(
  author: string,
  title: string,
  daysAgo: number,
  minutes: number,
  route: Route,
  climbM: number,
  found: readonly (readonly [string, DangerLevel])[],
): Trek {
  const endedAt = BASE - daysAgo * DAY;
  const startedAt = endedAt - minutes * MIN;
  const sightings: Sighting[] = found.map(([label, danger], i) => {
    const f = (i + 1) / (found.length + 1);
    const [lat, lng] = route[Math.round(f * (route.length - 1))]!;
    return { kind: 'species' as const, photoUri: '', label, danger, takenAt: startedAt + f * minutes * MIN, lat, lng };
  });
  return {
    id: `sample-${title.toLowerCase().replace(/\W+/g, '-')}`,
    title,
    status: 'done',
    plannedFor: null,
    startedAt,
    endedAt,
    gear: [],
    sightings,
    sample: true,
    author,
    shared: true,
    plannedRoute: [],
    route,
    distanceM: routeLength(route),
    elevationGainM: climbM,
  };
}

export const COMMUNITY_POSTS: readonly Trek[] = [
  post('Meera', 'Ridge walk at sunrise', 1, 165, trail(10, 77, 70, 95, (i) => 0.22 * Math.sin(i / 6) + 0.03), 540, [
    ['Crown Flower / Madar (Calotropis gigantea)', 'dangerous'],
    ['Common Mormon Butterfly (Papilio polytes)', 'harmless'],
    ['Indian Rat Snake (Ptyas mucosa)', 'harmless'],
    ['Yellow Paper Wasp (Ropalidia marginata)', 'caution'],
  ]),
  post('Arjun', 'Lakeside evening loop', 2, 75, loop(10.05, 77.1, 60, 650), 35, [
    ['Green Darner Dragonfly (Anax junius)', 'harmless'],
    ['Water Hyacinth (Pontederia crassipes)', 'harmless'],
    ['Checkered Keelback (Fowlea piscator)', 'harmless'],
  ]),
  post('Kavya', 'Monsoon forest trail', 4, 200, trail(10.3, 76.8, 90, 85, (i) => 0.35 * Math.sin(i / 9) - 0.05 * Math.cos(i / 4)), 810, [
    ['Bamboo Pit Viper (Craspedocephalus gramineus)', 'dangerous'],
    ['Flame of the Forest / Palash (Butea monosperma)', 'harmless'],
    ['Signature Spider (Argiope anasuja)', 'harmless'],
    ['Red Weaver Ant (Oecophylla smaragdina)', 'caution'],
    ['Neem Tree (Azadirachta indica)', 'harmless'],
  ]),
  post('Rohan', 'Tea estate switchbacks', 6, 130, trail(10.8, 77.3, 80, 70, (i) => (i % 16 < 8 ? 0.38 : -0.38)), 620, [
    ['Blue Mormon Butterfly (Papilio polymnestor)', 'harmless'],
    ['Green Vine Snake (Ahaetulla nasuta)', 'harmless'],
  ]),
  post('Nila', 'Waterfall out-and-back', 9, 95, trail(11.5, 76.5, 50, 80, (i) => (i === 25 ? Math.PI : 0.12 * Math.sin(i / 3))), 260, [
    ['Hump-Nosed Pit Viper (Hypnale hypnale)', 'dangerous'],
    ['Bamboo (Bambusoideae)', 'harmless'],
    ['Lantana Camara (Lantana camara)', 'caution'],
  ]),
  post('Dev', 'Grassland plateau loop', 13, 150, loop(12.5, 77.6, 70, 1100), 180, [
    ['Indian Blister Beetle (Mylabris phalerata)', 'caution'],
    ['Indian Garden Lizard / Calotes (Calotes versicolor)', 'harmless'],
    ["Russell's Viper (Daboia russelii)", 'dangerous'],
    ['Touch-Me-Not / Sensitive Plant (Mimosa pudica)', 'harmless'],
  ]),
];
