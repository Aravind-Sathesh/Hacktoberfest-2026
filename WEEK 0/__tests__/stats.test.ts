jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: {} }));

import type { Submission } from '../src/cf';
import { heatmap, solvedHistory, solvesByDay, streaks } from '../src/stats';

const friday = new Date(2026, 9, 2, 12);
const daysAgo = (n: number) => new Date(friday.getTime() - n * 86_400_000);

const ok = (date: Date, index: string, verdict = 'OK'): Submission => ({
  id: Math.random(),
  creationTimeSeconds: date.getTime() / 1000,
  problem: { contestId: 1, index, name: index, tags: [] },
  verdict,
});

describe('solvesByDay', () => {
  it('counts each problem once, on the day it was first accepted', () => {
    const byDay = solvesByDay([ok(daysAgo(1), 'A'), ok(friday, 'A'), ok(friday, 'B'), ok(friday, 'C', 'WRONG_ANSWER')]);
    expect(byDay.get(daysAgo(1).toDateString())).toBe(1);
    expect(byDay.get(friday.toDateString())).toBe(1);
  });
});

describe('streaks', () => {
  it('keeps the current streak alive until today ends and tracks the best run', () => {
    const byDay = solvesByDay([ok(daysAgo(1), 'A'), ok(daysAgo(2), 'B'), ok(daysAgo(5), 'C'), ok(daysAgo(6), 'D'), ok(daysAgo(7), 'E')]);
    expect(streaks(byDay, friday)).toEqual({ current: 2, best: 3 });
  });
});

describe('heatmap', () => {
  it('ends with the current week and marks future days', () => {
    const grid = heatmap(solvesByDay([ok(friday, 'A')]), friday, 2);
    expect(grid).toHaveLength(2);
    expect(grid[1]).toEqual([0, 0, 0, 0, 0, 1, -1]); // friday solved, saturday is in the future
  });
});

describe('solvedHistory', () => {
  it('lists each accepted problem once at its first accept with its attempts, newest first', () => {
    const history = solvedHistory([
      ok(friday, 'A'),
      ok(daysAgo(2), 'A'),
      ok(daysAgo(3), 'A', 'WRONG_ANSWER'),
      ok(daysAgo(1), 'B'),
      ok(friday, 'C', 'WRONG_ANSWER'),
    ]);
    expect(history.map((s) => [s.problem.index, s.at, s.attempts])).toEqual([
      ['B', daysAgo(1).getTime(), 1],
      ['A', daysAgo(2).getTime(), 2],
    ]);
  });
});
