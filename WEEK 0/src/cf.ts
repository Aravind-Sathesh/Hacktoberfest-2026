import { File, Paths } from 'expo-file-system';

const BASE_URL = 'https://codeforces.com/api/';
// Codeforces allows one request per 2 seconds per client.
const MIN_GAP_MS = 2000;
const PROBLEMSET_TTL_MS = 24 * 60 * 60 * 1000;

export type Problem = {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
};

export type Submission = {
  id: number;
  creationTimeSeconds: number;
  problem: Problem;
  verdict?: string;
};

export type User = { handle: string; rating?: number; maxRating?: number };

export type RatingChange = {
  contestId: number;
  newRating: number;
  ratingUpdateTimeSeconds: number;
};

export type Contest = {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
};

export class CfError extends Error {}

export const problemId = (p: Pick<Problem, 'contestId' | 'index'>): string => `${p.contestId}${p.index}`;

export const isSolved = (s: Submission): boolean => s.verdict === 'OK';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = -Infinity;

async function request<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  let body: { status: string; result?: T; comment?: string };
  try {
    const res = await fetch(`${BASE_URL}${method}?${query}`);
    body = await res.json();
  } catch {
    throw new CfError('codeforces is unreachable');
  }
  if (body.status !== 'OK' || body.result === undefined) {
    throw new CfError(body.comment ?? `${method} failed`);
  }
  return body.result;
}

/** Every Codeforces call goes through here, so requests are serialized and spaced. */
export function call<T>(method: string, params: Record<string, string | number> = {}): Promise<T> {
  const next = queue.then(
    () => request<T>(method, params),
    () => request<T>(method, params),
  );
  queue = next.catch(() => undefined);
  return next;
}

export const userInfo = async (handle: string): Promise<User> =>
  (await call<User[]>('user.info', { handles: handle }))[0];

export const userRating = (handle: string) => call<RatingChange[]>('user.rating', { handle });

export const userStatus = (handle: string, count?: number) =>
  call<Submission[]>('user.status', count ? { handle, count } : { handle });

let contestsCache: { day: string; contests: Promise<Contest[]> } | null = null;

/** Fetched once a day: contests are scheduled days ahead, and each call costs 2s of rate limit. */
export function upcomingContests(): Promise<Contest[]> {
  const day = new Date().toDateString();
  if (contestsCache?.day !== day) {
    const contests = call<Contest[]>('contest.list').then((all) => all.filter((c) => c.phase === 'BEFORE'));
    contestsCache = { day, contests };
    // A failed fetch must not stick for the rest of the day.
    contests.catch(() => {
      contestsCache = null;
    });
  }
  return contestsCache.contests;
}

const problemsetCache = new File(Paths.cache, 'problemset.json');

/** Cached on disk for a day because the full set is several MB. Unrated problems are kept for upsolving fresh contests. */
export async function problemset(): Promise<Problem[]> {
  if (problemsetCache.exists) {
    const cached = JSON.parse(await problemsetCache.text()) as { at: number; problems: Problem[] };
    if (Date.now() - cached.at < PROBLEMSET_TTL_MS) return cached.problems;
  }
  const { problems } = await call<{ problems: Problem[] }>('problemset.problems');
  const slim = problems.map(({ contestId, index, name, rating, tags }) => ({ contestId, index, name, rating, tags }));
  problemsetCache.write(JSON.stringify({ at: Date.now(), problems: slim }));
  return slim;
}
