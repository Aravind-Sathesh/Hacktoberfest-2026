import type { Contest, Problem } from '../src/cf';
import { candidates, dailyTarget, mergeBlocks, pickDeterministic, recentContestId, shortlist, upsolve, withoutTags } from '../src/plan';

const targets = { weekday: { problems: 4, minutes: 150 }, weekend: { problems: 6, minutes: 240 } };
const friday = new Date(2026, 9, 2, 9);
const saturday = new Date(2026, 9, 3, 9);
const at = (date: Date, hour: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).getTime();

const problem = (contestId: number, index: string, rating: number | undefined, tags: string[]): Problem => ({
  contestId,
  index,
  name: `${contestId}${index}`,
  rating,
  tags,
});

describe('mergeBlocks', () => {
  it('merges overlapping and touching blocks and sorts them', () => {
    expect(
      mergeBlocks([
        { start: 50, end: 60 },
        { start: 0, end: 10 },
        { start: 5, end: 20 },
        { start: 20, end: 30 },
      ]),
    ).toEqual([
      { start: 0, end: 30 },
      { start: 50, end: 60 },
    ]);
  });
});

describe('dailyTarget', () => {
  it('uses the weekday target on a free weekday', () => {
    expect(dailyTarget(friday, [], [], targets)).toEqual({ problems: 4, minutes: 150, contestToday: false });
  });

  it('uses the weekend target on a free weekend', () => {
    expect(dailyTarget(saturday, [], [], targets)).toEqual({ problems: 6, minutes: 240, contestToday: false });
  });

  it('scales down on a busy day', () => {
    // Busy 08:00–23:00 leaves 60 of the waking minutes.
    const busy = [{ start: at(friday, 8), end: at(friday, 23) }];
    expect(dailyTarget(friday, busy, [], targets)).toEqual({ problems: 1, minutes: 60, contestToday: false });
  });

  it('drops to warm-ups on a contest day', () => {
    const contest: Contest = { id: 1, name: 'div 2', phase: 'BEFORE', startTimeSeconds: at(friday, 20) / 1000 };
    expect(dailyTarget(friday, [], [contest], targets)).toEqual({ problems: 2, minutes: 150, contestToday: true });
  });
});

describe('candidates', () => {
  it('keeps unsolved problems 100–300 above the rating, minus excluded tags', () => {
    const problems = [
      problem(1, 'A', 1100, ['math']), // too easy
      problem(1, 'B', 1200, ['math']),
      problem(1, 'C', 1400, ['dp', 'math']), // excluded tag
      problem(1, 'D', 1300, ['math']), // solved
      problem(1, 'E', 1500, ['math']), // too hard
      problem(1, 'F', undefined, ['math']), // unrated
    ];
    expect(candidates(withoutTags(problems, ['dp']), new Set(['1D']), 1100).map((p) => p.index)).toEqual(['B']);
  });
});

describe('upsolve', () => {
  it('returns the unsolved problems of the recent contest', () => {
    const now = new Date(2026, 9, 2, 12);
    const contestId = recentContestId([{ contestId: 7, newRating: 1150, ratingUpdateTimeSeconds: now.getTime() / 1000 - 3600 }], now);
    const problems = [problem(7, 'A', 800, []), problem(7, 'B', undefined, []), problem(8, 'A', 800, [])];
    expect(contestId).toBe(7);
    expect(upsolve(7, problems, new Set(['7A'])).map((p) => p.index)).toEqual(['B']);
  });
});

describe('pickDeterministic', () => {
  it('picks easiest first, preferring distinct tags', () => {
    const options = [problem(1, 'A', 1200, ['math']), problem(2, 'A', 1200, ['math']), problem(3, 'A', 1300, ['dp'])];
    expect(pickDeterministic(options, 2).map((p) => p.contestId)).toEqual([2, 3]);
  });
});

describe('shortlist', () => {
  const options = Array.from({ length: 40 }, (_, i) => problem(i, 'A', 1200, []));

  it('samples 25 distinct problems, a different set for a different roll', () => {
    const first = shortlist(options, () => 0).map((p) => p.contestId);
    const last = shortlist(options, () => 0.999).map((p) => p.contestId);
    expect(new Set(first).size).toBe(25);
    expect(first).not.toEqual(last);
  });

  it('keeps everything when there are fewer than 25', () => {
    expect(shortlist(options.slice(0, 3)).length).toBe(3);
  });
});
