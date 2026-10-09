import { activeCount, applyFilters, DEFAULT_FILTERS, distanceSteps, fromRow, proximitySteps, toRow } from '../src/community';
import { EMPTY_STATE, planTrek, type Trek } from '../src/treks';

const post = (id: string, lat: number, km: number, minutes: number, climb: number, endedAt: number): Trek => ({
  ...planTrek(id, null, [], 0),
  id,
  route: [[lat, 77], [lat + 0.01, 77]],
  status: 'done',
  startedAt: endedAt - minutes * 60000,
  endedAt,
  distanceM: km * 1000,
  elevationGainM: climb,
});

const near = post('near', 10.01, 4, 90, 100, 3000);
const mid = post('mid', 10.2, 8, 180, 500, 1000);
const far = post('far', 11, 14, 300, 900, 2000);
const all = [near, mid, far];
const here = { lat: 10, lng: 77 };
const ids = (ts: Trek[]) => ts.map((t) => t.id);

test('proximity steps hide routes that start too far away, and nearest sorts by distance from you', () => {
  const within25 = proximitySteps('metric')[2]!.value;
  expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, within: within25 }, here))).toEqual(['near', 'mid']);
  expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, sort: 'nearest' }, null))).toEqual(['near', 'far', 'mid']);
  expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, sort: 'nearest' }, here))).toEqual(['near', 'mid', 'far']);
  // Without a location the proximity filter is skipped, not "nothing matches"
  expect(applyFilters(all, { ...DEFAULT_FILTERS, within: within25 }, null)).toHaveLength(3);
});

test('length, time and climb bands combine, and the badge counts only filters', () => {
  const medium = distanceSteps('metric')[2]!.value; // 5–10 km
  const f = { ...DEFAULT_FILTERS, distance: medium, minutes: { min: 120, max: 240 }, sort: 'flattest' as const };
  expect(ids(applyFilters(all, f, here))).toEqual(['mid']);
  expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, sort: 'longest' }, here))).toEqual(['far', 'mid', 'near']);
  expect(activeCount(f)).toBe(2);
  expect(EMPTY_STATE.units).toBe('metric');
});

test('a posted row never carries photos, and reads back as the same trek', () => {
  const trek: Trek = {
    ...mid,
    sightings: [{ kind: 'species', photoUri: 'file:///private/cobra.jpg', label: 'Cobra', danger: 'dangerous', takenAt: 500, lat: 10.2, lng: 77 }],
  };
  const row = toRow(trek, 'Aravind');
  expect(JSON.stringify(row)).not.toContain('file://');
  const back = fromRow({ ...row, id: 'abc' });
  expect(back).toMatchObject({ id: 'post-abc', author: 'Aravind', title: 'mid', distanceM: 8000, route: trek.route, shared: true });
  expect(back.sightings[0]).toMatchObject({ label: 'Cobra', danger: 'dangerous', photoUri: '' });
});
