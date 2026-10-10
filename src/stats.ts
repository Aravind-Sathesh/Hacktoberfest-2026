import { type Problem, type Submission, isSolved, problemId } from './cf';

const DAY_MS = 86_400_000;

const dayKey = (date: Date) => date.toDateString();

/** Distinct problems accepted per local day, keyed by `Date.toDateString()`. */
export function solvesByDay(submissions: Submission[]): Map<string, number> {
  const seen = new Set<string>();
  const byDay = new Map<string, number>();
  // Oldest first, so a problem counts on the day it was first solved.
  for (const s of [...submissions].sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds)) {
    const id = problemId(s.problem);
    if (!isSolved(s) || seen.has(id)) continue;
    seen.add(id);
    const key = dayKey(new Date(s.creationTimeSeconds * 1000));
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return byDay;
}

export type Solve = { problem: Problem; at: number; attempts: number };

/** Each accepted problem once, at its first accept (epoch ms), with every submission up to it; newest first. */
export function solvedHistory(submissions: Submission[]): Solve[] {
  const solves = new Map<string, Solve>();
  const tries = new Map<string, number>();
  for (const s of [...submissions].sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds)) {
    const id = problemId(s.problem);
    if (solves.has(id)) continue;
    const attempts = (tries.get(id) ?? 0) + 1;
    tries.set(id, attempts);
    if (isSolved(s)) solves.set(id, { problem: s.problem, at: s.creationTimeSeconds * 1000, attempts });
  }
  return [...solves.values()].sort((a, b) => b.at - a.at);
}

const daysBack = (today: Date, n: number) => new Date(today.getTime() - n * DAY_MS);

/** Current streak still counts if today has no solve yet but yesterday did. */
export function streaks(byDay: Map<string, number>, today: Date): { current: number; best: number } {
  let current = 0;
  for (let n = byDay.has(dayKey(today)) ? 0 : 1; byDay.has(dayKey(daysBack(today, n))); n++) current++;

  const days = [...byDay.keys()].map((k) => new Date(k).getTime()).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((t, i) => {
    run = i > 0 && Math.round((t - days[i - 1]) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best };
}

/** `weeks` columns of 7 days (sun → sat), oldest first, ending with the week containing today. Future days are -1. */
export function heatmap(byDay: Map<string, number>, today: Date, weeks: number): number[][] {
  const lastSaturday = daysBack(today, today.getDay() - 6);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = daysBack(lastSaturday, (weeks - 1 - w) * 7 + (6 - d));
      return date > today ? -1 : byDay.get(dayKey(date)) ?? 0;
    }),
  );
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Problems he had already got accepted before the given day began. */
export const solvedBeforeDay = (submissions: Submission[], day: Date): string[] => [
  ...new Set(
    submissions.filter((s) => isSolved(s) && s.creationTimeSeconds * 1000 < startOfDay(day)).map((s) => problemId(s.problem)),
  ),
];

/** New problems solved on the given day: accepted that day and never before. */
export function solvesOnDay(submissions: Submission[], solvedBefore: Set<string>, day: Date): number {
  const start = startOfDay(day);
  const end = start + DAY_MS;
  const today = submissions.filter(
    (s) => isSolved(s) && s.creationTimeSeconds * 1000 >= start && s.creationTimeSeconds * 1000 < end,
  );
  return new Set(today.map((s) => problemId(s.problem)).filter((id) => !solvedBefore.has(id))).size;
}
