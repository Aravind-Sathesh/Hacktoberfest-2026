import type { Contest, Problem, RatingChange } from './cf';
import { problemId } from './cf';

/** A busy span in epoch milliseconds. */
export type Block = { start: number; end: number };

export type DayTarget = { problems: number; minutes: number };
export type Targets = { weekday: DayTarget; weekend: DayTarget };

export type Today = DayTarget & { contestToday: boolean };

// The waking window that busy time is subtracted from.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 24;
const MIN_USEFUL_MINUTES = 30;
const CONTEST_DAY_WARMUPS = 2;
const UPSOLVE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const atHour = (date: Date, hour: number) => {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Overlapping or touching blocks become one; output is sorted. */
export function mergeBlocks(blocks: Block[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged: Block[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  }
  return merged;
}

export function freeMinutes(date: Date, busy: Block[]): number {
  const dayStart = atHour(date, DAY_START_HOUR);
  const dayEnd = atHour(date, DAY_END_HOUR);
  const busyMs = mergeBlocks(busy).reduce((sum, b) => {
    const overlap = Math.min(b.end, dayEnd) - Math.max(b.start, dayStart);
    return sum + Math.max(0, overlap);
  }, 0);
  return Math.floor((dayEnd - dayStart - busyMs) / MINUTE_MS);
}

export function dailyTarget(date: Date, busy: Block[], contests: Contest[], targets: Targets): Today {
  const base = isWeekend(date) ? targets.weekend : targets.weekday;
  const free = freeMinutes(date, busy);
  const contestToday = contests.some(
    (c) => c.startTimeSeconds !== undefined && sameDay(new Date(c.startTimeSeconds * 1000), date),
  );

  let problems = base.problems;
  let minutes = base.minutes;
  if (free < base.minutes) {
    minutes = free;
    problems = Math.floor((base.problems * free) / base.minutes);
    if (free >= MIN_USEFUL_MINUTES) problems = Math.max(1, problems);
  }
  if (contestToday) problems = Math.min(problems, CONTEST_DAY_WARMUPS);

  return { problems, minutes, contestToday };
}

/** Problems a little above the current rating: hard enough to grow, close enough to solve. */
export const withoutTags = (problems: Problem[], excluded: string[]): Problem[] =>
  problems.filter((p) => !p.tags.some((t) => excluded.includes(t)));

export function candidates(problems: Problem[], solved: Set<string>, rating: number): Problem[] {
  return problems.filter(
    (p) =>
      p.rating !== undefined &&
      p.rating >= rating + 100 &&
      p.rating <= rating + 300 &&
      !solved.has(problemId(p)),
  );
}

/** The contest whose rating update landed in the last two days, if any. */
export function recentContestId(changes: RatingChange[], now: Date): number | undefined {
  const last = changes[changes.length - 1];
  if (!last) return undefined;
  return now.getTime() - last.ratingUpdateTimeSeconds * 1000 <= UPSOLVE_WINDOW_MS ? last.contestId : undefined;
}

export function upsolve(contestId: number, problems: Problem[], solved: Set<string>): Problem[] {
  return problems.filter((p) => p.contestId === contestId && !solved.has(problemId(p)));
}

const SHORTLIST_SIZE = 25;

/** A random sample small enough for the model's context, so every refresh brings different problems. */
export function shortlist(options: Problem[], random: () => number = Math.random): Problem[] {
  const pool = [...options];
  const size = Math.min(SHORTLIST_SIZE, pool.length);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

/** Easiest first as a warm-up, one per tag before any tag repeats. */
export function pickDeterministic(options: Problem[], count: number): Problem[] {
  const sorted = [...options].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0) || b.contestId - a.contestId);
  const picked: Problem[] = [];
  const seenTags = new Set<string>();
  for (const p of sorted) {
    if (picked.length === count) break;
    const tag = p.tags[0] ?? '';
    if (!seenTags.has(tag)) {
      seenTags.add(tag);
      picked.push(p);
    }
  }
  for (const p of sorted) {
    if (picked.length === count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}

/** TLE's CP-31 sheet as they shared it: per rating level, problems in the order the sheet lists them. */
export type Sheet = Record<string, { name: string; link: string }[]>;

const SHEET_LINK = /\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Z]\d?)\b/;

export type SheetSpot = { level: number; position: number };
type SheetEntry = SheetSpot & { contestId: number; index: string; name: string };

/** Every sheet problem in sheet order: lowest level first, then its place within the level. */
function sheetEntries(sheet: Sheet): SheetEntry[] {
  return Object.entries(sheet)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([level, list]) =>
      list.flatMap(({ name, link }, i) => {
        const match = link.match(SHEET_LINK);
        return match ? [{ contestId: Number(match[1]), index: match[2], name, level: Number(level), position: i + 1 }] : [];
      }),
    );
}

const entryId = (e: SheetEntry) => `${e.contestId}${e.index}`;

/** Where each problem sits on the sheet, by problem id: its level and 1-based place in that level. */
export const sheetSpots = (sheet: Sheet): Map<string, SheetSpot> =>
  new Map(sheetEntries(sheet).map((e) => [entryId(e), { level: e.level, position: e.position }]));

/**
 * What's next on the sheet for him, minus what he has solved. His most recent sheet solve is where he
 * is: the queue picks up right after it, then the ones he skipped earlier in that level, then the levels
 * above. With no sheet solves yet, it starts at his rating level. A rating he chose in Settings overrides
 * both and starts at that level. The problemset copy is used when there is one, for its tags.
 */
export function sheetQueue(
  sheet: Sheet,
  problems: Problem[],
  solvedAt: Map<string, number>,
  rating: number,
  chosenRating?: number,
): Problem[] {
  const entries = sheetEntries(sheet);
  const levels = [...new Set(entries.map((e) => e.level))];
  const latest = entries
    .filter((e) => solvedAt.has(entryId(e)))
    .sort((a, b) => solvedAt.get(entryId(b))! - solvedAt.get(entryId(a))!)[0];
  const levelFor = (r: number) => levels.filter((level) => level <= r).at(-1) ?? levels[0];
  const start = chosenRating !== undefined ? levelFor(chosenRating) : (latest?.level ?? levelFor(rating));
  const open = entries.filter((e) => e.level >= start && !solvedAt.has(entryId(e)));
  const skipped = (e: SheetEntry) => latest !== undefined && e.level === latest.level && e.position < latest.position;
  const byId = new Map(problems.map((p) => [problemId(p), p]));
  const inLevel = open.filter((e) => e.level === start);
  const ordered = [...inLevel.filter((e) => !skipped(e)), ...inLevel.filter(skipped), ...open.filter((e) => e.level > start)];
  return ordered
    .map((e) => byId.get(entryId(e)) ?? { contestId: e.contestId, index: e.index, name: e.name, rating: e.level, tags: [] });
}
