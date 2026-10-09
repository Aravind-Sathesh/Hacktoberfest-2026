import {
  DEFAULT_CHECKLISTS,
  EMPTY_STATE,
  GEAR_CHECKLIST,
  addSighting,
  duration,
  endTrek,
  feed,
  isValidPhone,
  nextDays,
  parseState,
  planTrek,
  speciesSummary,
  startTrek,
  type AppState,
  type Sighting,
  type Trek,
} from '../src/treks';
import { COMMUNITY_POSTS } from '../src/samples';
import labels from '../assets/bioclip_labels.json';

describe('treks.ts pure functions', () => {
  test('GEAR_CHECKLIST contains the 10 survival checklist items in order', () => {
    expect(GEAR_CHECKLIST).toEqual([
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
    ]);
  });

  test('planTrek creates a planned trek with String(now) as id', () => {
    const now = 1791446400000;
    const trek = planTrek('Ridge Walk', '2026-10-10', [{ name: 'Water', packed: true }], now);
    expect(trek).toEqual({
      id: String(now),
      title: 'Ridge Walk',
      status: 'planned',
      plannedFor: '2026-10-10',
      startedAt: null,
      endedAt: null,
      gear: [{ name: 'Water', packed: true }],
      sightings: [],
      sample: false,
      author: null,
      shared: false,
      plannedRoute: [],
      route: [],
      distanceM: 0,
      elevationGainM: 0,
    });
  });

  test('startTrek activates planned trek or creates impromptu trek, with at most one active', () => {
    const now = new Date('2026-10-08T09:00:00Z').getTime();
    const planned = planTrek('Morning Hike', '2026-10-08', [], 100);
    const initial: AppState = { ...EMPTY_STATE, treks: [planned] };

    // Activate planned trek
    const activated = startTrek(initial, '100', now);
    expect(activated.treks[0].status).toBe('active');
    expect(activated.treks[0].startedAt).toBe(now);

    // Prevent second active trek
    // The pre-start checklist's ticks are kept on the trek
    const packed = startTrek(initial, planned.id, now, [{ name: 'Water', packed: true }]);
    expect(packed.treks[0]?.gear).toEqual([{ name: 'Water', packed: true }]);

    const secondTry = startTrek(activated, null, now + 1000);
    expect(secondTry).toBe(activated);

    // Impromptu trek when none active
    const emptyState: AppState = { ...EMPTY_STATE, treks: [] };
    const impromptuState = startTrek(emptyState, null, now);
    expect(impromptuState.treks).toHaveLength(1);
    expect(impromptuState.treks[0].status).toBe('active');
    expect(impromptuState.treks[0].title).toBe('Trek on 8 Oct');
    expect(impromptuState.treks[0].gear).toEqual([]);
  });

  test('endTrek turns active trek into done with endedAt', () => {
    const start = 1000;
    const end = 5000;
    const activeTrek: Trek = {
      id: '1',
      title: 'Active Trek',
      status: 'active',
      plannedFor: null,
      startedAt: start,
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
    const state: AppState = { ...EMPTY_STATE, treks: [activeTrek] };
    const ended = endTrek(state, end, { distanceM: 1200, elevationGainM: 40 }, [[1, 2], [3, 4]]);

    expect(ended.treks[0].status).toBe('done');
    expect(ended.treks[0].endedAt).toBe(end);
    expect(ended.treks[0].distanceM).toBe(1200);
    expect(ended.treks[0].route).toEqual([[1, 2], [3, 4]]);

    // No-op when no active trek
    const noOp = endTrek({ ...EMPTY_STATE, treks: [] }, end, { distanceM: 0, elevationGainM: 0 }, []);
    expect(noOp.treks).toHaveLength(0);
  });

  test('addSighting appends sighting to active trek, does nothing if none active', () => {
    const sighting: Sighting = {
      kind: 'species',
      photoUri: 'file:///photo.jpg',
      label: 'Crown Flower',
      danger: 'dangerous',
      takenAt: 1234,
      lat: null,
      lng: null,
    };
    const activeTrek: Trek = {
      id: '1',
      title: 'Active',
      status: 'active',
      plannedFor: null,
      startedAt: 100,
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
    const state: AppState = { ...EMPTY_STATE, treks: [activeTrek] };
    const withSighting = addSighting(state, sighting);
    expect(withSighting.treks[0].sightings).toEqual([sighting]);

    // Inactive trek state
    const doneTrek: Trek = { ...activeTrek, status: 'done', endedAt: 200 };
    const unchanged = addSighting({ ...EMPTY_STATE, treks: [doneTrek] }, sighting);
    expect(unchanged.treks[0].sightings).toEqual([]);
  });

  test('feed sorts active first, planned by plannedFor ascending, done by endedAt descending', () => {
    const doneOld: Trek = {
      id: 'd1',
      title: 'Done 1',
      status: 'done',
      plannedFor: null,
      startedAt: 10,
      endedAt: 100,
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
    const doneRecent: Trek = {
      id: 'd2',
      title: 'Done 2',
      status: 'done',
      plannedFor: null,
      startedAt: 20,
      endedAt: 200,
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
    const plannedEarly: Trek = {
      id: 'p1',
      title: 'Planned Early',
      status: 'planned',
      plannedFor: '2026-10-09',
      startedAt: null,
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
    const plannedLate: Trek = {
      id: 'p2',
      title: 'Planned Late',
      status: 'planned',
      plannedFor: '2026-10-15',
      startedAt: null,
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
    const active: Trek = {
      id: 'a1',
      title: 'Active',
      status: 'active',
      plannedFor: null,
      startedAt: 50,
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

    const sorted = feed([doneOld, plannedLate, active, doneRecent, plannedEarly]);
    expect(sorted.map((t) => t.id)).toEqual(['a1', 'p1', 'p2', 'd2', 'd1']);
  });

  test('duration formats elapsed time into "45 min" or "2 h 10 min"', () => {
    const start = 1000000;
    expect(duration(start, start + 45 * 60000)).toBe('45 min');
    expect(duration(start, start + 130 * 60000)).toBe('2 h 10 min');
    expect(duration(start, start + 120 * 60000)).toBe('2 h');
    expect(duration(null, start)).toBe('0 min');
  });

  test('nextDays returns next N days with Today, Tomorrow, and short weekday labels', () => {
    // 2026-10-08 is Thursday
    const now = new Date(2026, 9, 8, 10, 0, 0).getTime();
    const days = nextDays(now, 4);
    expect(days).toEqual([
      { iso: '2026-10-08', label: 'Today' },
      { iso: '2026-10-09', label: 'Tomorrow' },
      { iso: '2026-10-10', label: 'Sat 10' },
      { iso: '2026-10-11', label: 'Sun 11' },
    ]);
  });

  test('isValidPhone validates 2 to 15 digits with optional leading + and spaces', () => {
    expect(isValidPhone('112')).toBe(true);
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(isValidPhone('+1 800 555 0199')).toBe(true);
    expect(isValidPhone('99')).toBe(true);
    expect(isValidPhone('9')).toBe(false); // only 1 digit
    expect(isValidPhone('+')).toBe(false);
    expect(isValidPhone('abc1234')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false); // 16 digits
    expect(isValidPhone('')).toBe(false);
  });

  test('parseState never throws, flags unreadable files, drops stored samples and fills fields older saves lack', () => {
    // null means "unreadable": the caller must keep the file, not overwrite it with an empty state
    expect(parseState('')).toBeNull();
    expect(parseState('{"profile":{"name":"Ara')).toBeNull();
    expect(parseState('42')).toBeNull();
    expect(parseState('{}')).toEqual(EMPTY_STATE);
    expect(parseState('{"profile": 123}')).toEqual({ ...EMPTY_STATE, treks: [] });

    const parsed = parseState(
      JSON.stringify({
        profile: { name: 'Aravind', experience: 'regular', emergencyNumber: '112', contact: null },
        treks: [
          { id: 'old', title: 'Old save', status: 'done', plannedFor: null, startedAt: 0, endedAt: 100, gear: [], sightings: [{ photoUri: '', label: 'X', danger: 'harmless', takenAt: 5 }], sample: false },
          { id: 's', title: 'Sample', status: 'done', gear: [], sightings: [], sample: true },
          { id: 42 },
        ],
      }),
    );
    expect(parsed?.profile?.name).toBe('Aravind');
    // Profiles saved before photos existed load with none
    expect(parsed?.profile).toMatchObject({ photoUri: null, avatarUrl: null });
    expect(parsed?.treks.map((t) => t.id)).toEqual(['old']);
    expect(parsed?.treks[0]).toMatchObject({ route: [], distanceM: 0, elevationGainM: 0 });
    expect(parsed?.treks[0]?.sightings[0]).toMatchObject({ kind: 'species', lat: null, lng: null });
    // Settings older saves didn't have
    expect(parsed).toMatchObject({ theme: 'dark', accent: 'lake', units: 'metric', checklists: DEFAULT_CHECKLISTS });
  });

  test('speciesSummary lists each species once and counts dangerous species, not photos', () => {
    const s = (label: string, danger: Sighting['danger']): Sighting => ({ kind: 'species', photoUri: '', label, danger, takenAt: 0, lat: null, lng: null });
    const { species, dangerous } = speciesSummary([s('Crown', 'dangerous'), s('Crown', 'dangerous'), s('Cobra', 'dangerous'), s('Neem', 'harmless')]);
    expect(species.map((x) => x.label)).toEqual(['Crown', 'Cobra', 'Neem']);
    expect(dangerous).toBe(2);
    const view: Sighting = { ...s('Sunset', 'harmless'), kind: 'scenery' };
    expect(speciesSummary([view]).species).toEqual([]);
  });
});

test('sample Community posts only use real labels, with the danger level from the label data', () => {
  const danger = new Map(labels.labels.map((l) => [l.label, l.danger]));
  for (const post of COMMUNITY_POSTS) {
    for (const s of post.sightings) expect([s.label, s.danger]).toEqual([s.label, danger.get(s.label)]);
    expect(post.shared && post.sample).toBe(true);
  }
});
