import { cleanTrack, clock, distanceToRoute, isOffRoute, routeBounds, fitRoute, formatDistance, formatElevation, haversine, pace, parseTrack, routePath, simplify, trackStats, type TrackPoint } from '../src/track';

const pt = (lat: number, lng: number, alt: number | null = null, t = 0): TrackPoint => ({ lat, lng, alt, acc: 5, t });

test('haversine: 0.001 deg of latitude is ~111 m', () => {
  expect(haversine(10, 76, 10.001, 76)).toBeCloseTo(111.2, 0);
});

test('parseTrack skips torn, incomplete and inaccurate lines', () => {
  const text = [
    JSON.stringify(pt(10, 76)),
    '{"lat":10.1,"lng":',
    JSON.stringify({ lat: 1, lng: 2 }),
    JSON.stringify({ ...pt(11, 77), acc: 200 }),
    JSON.stringify(pt(12, 78)),
    '',
  ].join('\n');
  expect(parseTrack(text).map((p) => p.lat)).toEqual([10, 12]);
});

test('trackStats ignores altitude jitter below 3 m but counts real climbs', () => {
  const jitter = [100, 102, 99, 101, 100].map((a, i) => pt(10 + i * 0.001, 76, a));
  expect(trackStats(jitter).elevationGainM).toBe(0);
  const climb = [100, 105, 103, 110, 120].map((a, i) => pt(10 + i * 0.001, 76, a, i * 60000));
  // 100→105 (+5), dips to 103 (new base), 103→110 (+7), 110→120 (+10)
  expect(trackStats(climb).elevationGainM).toBe(22);
  expect(trackStats(climb).distanceM).toBeCloseTo(444.8, 0);
});

test('simplify keeps both ends and caps the point count', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => pt(i, i));
  const r = simplify(pts, 50);
  expect(r).toHaveLength(50);
  expect(r[0]).toEqual([0, 0]);
  expect(r[49]).toEqual([999, 999]);
  expect(simplify(pts.slice(0, 3), 50)).toHaveLength(3);
});

test('formatDistance, pace and clock read like a hiking app', () => {
  expect(formatDistance(850)).toBe('850 m');
  expect(formatDistance(4230)).toBe('4.2 km');
  expect(pace(2000, 30 * 60000)).toBe('15:00 /km');
  expect(pace(50, 60000)).toBeNull();
  expect(clock(245000)).toBe('4:05');
  // Imperial: short distances in feet, longer in miles; climb in feet; pace per mile
  expect(formatDistance(100, 'imperial')).toBe('328 ft');
  expect(formatDistance(4230, 'imperial')).toBe('2.6 mi');
  expect(formatElevation(540, 'imperial')).toBe('1772 ft');
  expect(pace(1609.344, 15 * 60000, 'imperial')).toBe('15:00 /mi');
  expect(clock(3845000)).toBe('1:04:05');
});

test('fitRoute keeps the shape inside the box and centres it', () => {
  const route: [number, number][] = [[10, 76], [10.01, 76], [10.01, 76.01]];
  const project = fitRoute(route, 200, 100, 10);
  for (const [lat, lng] of route) {
    const { x, y } = project(lat, lng);
    expect(x).toBeGreaterThanOrEqual(10);
    expect(x).toBeLessThanOrEqual(190);
    expect(y).toBeGreaterThanOrEqual(10);
    expect(y).toBeLessThanOrEqual(90);
  }
  // North is up: the higher latitude is drawn higher
  expect(project(10.01, 76).y).toBeLessThan(project(10, 76).y);
  expect(routePath(route, project).startsWith('M')).toBe(true);
  // A single point lands in the middle instead of dividing by zero
  expect(fitRoute([[10, 76]], 200, 100, 10)(10, 76)).toEqual({ x: 100, y: 50 });
});

test('cleanTrack drops a far-away first fix and a one-off spike, keeping the walk', () => {
  const walk = Array.from({ length: 6 }, (_, i) => pt(10 + i * 0.0002, 77, null, 60000 + i * 5000));
  const stale = pt(37.42, -122.08, null, 55000);
  const spike = pt(10.05, 77, null, 72000);
  const cleaned = cleanTrack([stale, ...walk.slice(0, 3), spike, ...walk.slice(3)]);
  expect(cleaned.map((p) => p.lat)).toEqual(walk.map((p) => p.lat));
  // Distance counts only the walk (5 steps of ~22 m), never the jump
  expect(trackStats([stale, ...walk]).distanceM).toBeCloseTo(111.2, 0);
  // Right after starting there is no 3-point run yet: keep the newest fix rather than nothing
  expect(cleanTrack([stale, walk[0]!])).toEqual([walk[0]]);
});

test('routeBounds pads the route by real metres, west/south/east/north order', () => {
  const b = routeBounds([[10, 77], [10.01, 77.02]], 1113.2)!;
  expect(b[1]).toBeCloseTo(9.99, 4); // south: 0.01° of latitude is ~1113 m
  expect(b[3]).toBeCloseTo(10.02, 4);
  expect(b[0]).toBeLessThan(77);
  expect(b[2]).toBeGreaterThan(77.02);
  expect(routeBounds([], 100)).toBeNull();
});

test('distanceToRoute measures to the segment, not just its corners', () => {
  const route: [number, number][] = [[10, 77], [10, 77.01]]; // ~1.1 km east–west
  // Halfway along, 0.0005° north: ~55 m from the line, though ~550 m from either end
  expect(distanceToRoute(10.0005, 77.005, route)).toBeCloseTo(55.7, 0);
  expect(distanceToRoute(10, 77.005, route)).toBeCloseTo(0, 5);
});

test('isOffRoute needs two far fixes to alert, and clearly-near to clear', () => {
  const planned: [number, number][] = [[10, 77], [10, 77.01]];
  const at = (dLatM: number) => pt(10 + dLatM / 111320, 77.005);
  expect(isOffRoute([at(10), at(80)], planned, false)).toBe(false); // one stray fix
  expect(isOffRoute([at(80), at(90)], planned, false)).toBe(true);
  expect(isOffRoute([at(90), at(50)], planned, true)).toBe(true); // still in the grey zone
  expect(isOffRoute([at(50), at(20)], planned, true)).toBe(false);
  expect(isOffRoute([at(500), at(500)], [], false)).toBe(false); // no plan, no alerts
});
