import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { todaysBusyBlocks } from '../calendar';
import { CfError, type Problem, type RatingChange, isSolved, problemId, problemset, upcomingContests, userRating, userStatus } from '../cf';
import { MODEL_SIZE_LABEL, canRunGemma, downloadModel, isDownloading, isModelDownloaded } from '../gemma';
import cp31 from '../cp31.json';
import { type Today, candidates, dailyTarget, pickDeterministic, recentContestId, sheetQueue, sheetSpots, shortlist, upsolve, withoutTags } from '../plan';
import { CardStack } from '../CardStack';
import { DayTrees } from '../DayTrees';
import { updateTodayWidget } from '../widgetTaskHandler';
import { type Session, forest, loadSessions } from '../sessions';
import { type Settings, daysUntil } from '../settings';
import { heatmap, solvedBeforeDay, solvesByDay, streaks } from '../stats';
import { colors, radius } from '../theme';
import { Bone, Button, Card, Chip, Divider, Mono, SkeletonPulse, Stat } from '../ui';

/** No problem means he picks it on the focus screen. */
type Props = { settings: Settings; onFocus: (problem?: Problem) => void };

type Loaded = {
  rating: number;
  today: Today;
  plan: Problem[];
  solved: Set<string>;
  byDay: Map<string, number>;
  /** Problems accepted before today; the widget's tap-refresh counts new solves against these. */
  solvedBefore: string[];
  sessions: Session[];
};

// The day's suggestions are picked once and kept, so a refresh never reshuffles them.
type DayPlan = { key: string; problems: Problem[] };

const PLAN_KEY = 'plan';
const CP31_SPOTS = sheetSpots(cp31);
// Twice the target, so there's room to skip what doesn't appeal.
const SUGGESTIONS_PER_TARGET = 2;
const UNRATED_START = 800;
const HEATMAP_WEEKS = 16;

let cachedData: Loaded | null = null;
let lastSettings: Settings | null = null;
let cachedDay = '';
// Set after a solve: the cached page still shows while the fresh one loads behind a spinner.
let stale = false;

// Android keeps the app alive overnight, so a cache from yesterday is stale.
const cacheFor = (settings: Settings) =>
  lastSettings === settings && cachedDay === new Date().toDateString() ? cachedData : null;

/** A grown tree means a new solve, so the next visit to Today reloads. */
export const forgetToday = () => {
  stale = true;
};

// The last loaded Today, on the phone: shown the moment the app opens while the fresh one loads.
const SAVED_KEY = 'today-saved';
type Saved = Omit<Loaded, 'solved' | 'byDay'> & { handle: string; solved: string[]; byDay: [string, number][] };

const saveToday = (handle: string, loaded: Loaded) =>
  AsyncStorage.setItem(
    SAVED_KEY,
    JSON.stringify({ ...loaded, handle, solved: [...loaded.solved], byDay: [...loaded.byDay] } satisfies Saved),
  );

async function savedToday(handle: string): Promise<Loaded | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    if (!saved || saved.handle !== handle) return null;
    return { ...saved, solved: new Set(saved.solved), byDay: new Map(saved.byDay) };
  } catch {
    return null;
  }
}

const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

async function buildPlan(
  settings: Settings,
  now: Date,
  rating: number,
  today: Today,
  solvedAt: Map<string, number>,
  ratingChanges: RatingChange[],
): Promise<Problem[]> {
  const solved = new Set(solvedAt.keys());
  const all = await problemset();
  const problems = withoutTags(all, settings.excludedTags);
  const contestId = recentContestId(ratingChanges, now);
  const upsolves = contestId ? upsolve(contestId, problems, solved).slice(0, today.problems) : [];
  // An upsolve can also be on the sheet; it shouldn't show twice.
  const upsolveIds = new Set(upsolves.map(problemId));
  const fresh = (list: Problem[]) => list.filter((p) => !upsolveIds.has(problemId(p)));
  const wanted = SUGGESTIONS_PER_TARGET * today.problems - upsolves.length;
  const chosen = settings.practiceRating ?? undefined;
  const picks =
    settings.problemSource === 'cp31'
      ? // The full set, so a sheet problem with a skipped tag is found with its tags and then dropped.
        fresh(withoutTags(sheetQueue(cp31, all, solvedAt, rating, chosen), settings.excludedTags)).slice(0, wanted)
      : pickDeterministic(fresh(shortlist(candidates(problems, solved, chosen ?? rating))), wanted);
  return [...upsolves, ...picks];
}

// Any of these changing picks a new list. A calendar change can move the target mid-day; that alone never does.
async function todaysPlan(settings: Settings, pick: () => Promise<Problem[]>): Promise<Problem[]> {
  const key = JSON.stringify({
    day: new Date().toDateString(),
    handle: settings.handle,
    excludedTags: [...settings.excludedTags].sort(),
    source: settings.problemSource,
    practiceRating: settings.practiceRating,
    perTarget: SUGGESTIONS_PER_TARGET,
    // Bumped when the picking rules change, so a day's list built under the old rules is rebuilt once.
    rules: 2,
  });
  const stored = await AsyncStorage.getItem(PLAN_KEY);
  const plan = stored ? (JSON.parse(stored) as DayPlan) : null;
  if (plan?.key === key) return plan.problems;
  const problems = await pick();
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify({ key, problems }));
  return problems;
}

async function load(settings: Settings): Promise<Loaded> {
  const now = new Date();
  // The last rating change is the current rating, which saves a user.info call (2s of rate limit).
  const ratingChanges = await userRating(settings.handle);
  const rating = ratingChanges.at(-1)?.newRating ?? UNRATED_START;
  const submissions = await userStatus(settings.handle);
  // When he first got each problem accepted. The sheet continues from his most recent new sheet solve, so
  // re-solving an old problem doesn't drag him back down the sheet.
  const solvedAt = new Map<string, number>();
  const markSolved = (id: string, at: number) => solvedAt.set(id, Math.min(solvedAt.get(id) ?? Infinity, at));
  for (const s of submissions.filter(isSolved)) markSolved(problemId(s.problem), s.creationTimeSeconds * 1000);
  const sessions = await loadSessions();
  for (const s of sessions) if (s.outcome === 'grown') markSolved(s.problemId, s.at);
  const busy = await todaysBusyBlocks(now).catch(() => []);
  const today = dailyTarget(now, busy, await upcomingContests(), settings.targets);
  const plan = await todaysPlan(settings, () => buildPlan(settings, now, rating, today, solvedAt, ratingChanges));

  return {
    rating,
    today,
    plan,
    solved: new Set(solvedAt.keys()),
    byDay: solvesByDay(submissions),
    solvedBefore: solvedBeforeDay(submissions, now),
    sessions,
  };
}

type CardLabelProps = { problem: Problem; place: number; of: number; settings: Settings; contestDay: boolean };

/** "#6 CP-31 · 1400" for a sheet problem; an upsolve or a by-rating pick says what it is instead. */
function CardLabel({ problem, place, of, settings, contestDay }: CardLabelProps) {
  const spot = settings.problemSource === 'cp31' ? CP31_SPOTS.get(problemId(problem)) : undefined;
  const contest = contestDay ? ' · CONTEST DAY' : '';
  if (!spot) {
    const what = settings.problemSource === 'cp31' ? 'UPSOLVE · LAST CONTEST' : `SUGGESTED · ${place} OF ${of}`;
    return <Mono color={colors.muted} size={12}>{what}{contest}</Mono>;
  }
  return (
    <View style={styles.label}>
      <Mono bold size={12} color={settings.accent}>#{spot.position}</Mono>
      <Mono color={colors.muted} size={12}>
        CP-31{settings.showRatings ? ` · ${spot.level}` : ''}{contest}
      </Mono>
    </View>
  );
}

const heatColor = (count: number, accent: string) =>
  count < 0 ? 'transparent' : count === 0 ? colors.border : `${accent}${count === 1 ? '66' : count <= 3 ? 'b3' : 'ff'}`;

export function TodayScreen({ settings, onFocus }: Props) {
  const [data, setData] = useState<Loaded | null>(() => cacheFor(settings));
  const [loading, setLoading] = useState(!cacheFor(settings) || stale);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(isModelDownloaded());
  const accent = settings.accent;
  const showing = useRef(data !== null);
  showing.current = data !== null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await load(settings);
      cachedData = loaded;
      lastSettings = settings;
      cachedDay = new Date().toDateString();
      stale = false;
      setData(loaded);
      saveToday(settings.handle, loaded);
      updateTodayWidget({
        day: new Date().toDateString(),
        target: loaded.today.problems,
        targets: settings.targets,
        accent: settings.accent,
        solves: [...loaded.byDay],
        handle: settings.handle,
        solvedBefore: loaded.solvedBefore,
      });
    } catch (e) {
      setError(e instanceof CfError ? e.message : 'something broke while planning. pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    if (!cacheFor(settings) || stale) {
      // Show the last saved Today at once (local, a few ms), then replace it when Codeforces answers.
      if (!showing.current) savedToday(settings.handle).then((saved) => saved && setData((prev) => prev ?? saved));
      refresh();
    } else {
      // A lost tree changes only local stats; no need to ask Codeforces.
      loadSessions().then((sessions) =>
        setData((prev) => (prev ? (cachedData = { ...prev, sessions }) : prev)),
      );
    }
  }, [refresh, settings]);

  useEffect(() => {
    if (isDownloading()) getGemma();
  }, []);

  async function getGemma() {
    setDownload(0);
    try {
      await downloadModel(setDownload);
      setModelReady(true);
    } catch {
      setError('gemma download failed. check your connection and try again.');
    } finally {
      setDownload(null);
    }
  }

  const now = new Date();
  const isDone = (p: Problem) => data?.solved.has(problemId(p)) ?? false;
  // What's left comes first, so the first card is always the next one to do.
  const suggestions = data ? [...data.plan].sort((a, b) => Number(isDone(a)) - Number(isDone(b))) : [];
  const done = data?.byDay.get(now.toDateString()) ?? 0;
  const { current: streak, best } = data ? streaks(data.byDay, now) : { current: 0, best: 0 };
  const trees = data ? forest(data.sessions) : { grown: 0, dead: 0 };
  const sessionsToday = data?.sessions.filter((s) => new Date(s.at).toDateString() === now.toDateString()) ?? [];
  const focusedToday = sessionsToday.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, !data && styles.fill]}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} colors={[accent]} />}
    >
      {error && <Mono color={colors.danger}>{error}</Mono>}
      {loading && !data && <Skeleton />}

      {data && (
        <>
          {suggestions.length ? (
            <CardStack
              items={suggestions}
              keyOf={problemId}
              nextLabel="next suggested problem"
              renderCard={(p) => (
                <>
                  <CardLabel
                    problem={p}
                    place={suggestions.indexOf(p) + 1}
                    of={suggestions.length}
                    settings={settings}
                    contestDay={data.today.contestToday}
                  />
                  <View style={styles.cardRow}>
                    <View style={styles.grow}>
                      <Mono bold size={18} numberOfLines={1}>{p.name}</Mono>
                      <View style={styles.chips}>
                        {settings.showRatings && <Chip label={String(p.rating ?? 'unrated')} color={accent} />}
                        <Chip label={problemId(p)} />
                        {settings.showTags && p.tags.map((t) => <Chip key={t} label={t} />)}
                      </View>
                    </View>
                    {isDone(p) ? (
                      <Chip label="solved" color={accent} />
                    ) : (
                      <Button label={`focus on ${p.name}`} icon="play" iconOnly onPress={() => onFocus(p)} accent={accent} />
                    )}
                  </View>
                </>
              )}
            />
          ) : (
            <Card>
              <Mono bold size={18}>nothing suggested today.</Mono>
            </Card>
          )}

          <Button label="start focus" icon="play" onPress={() => onFocus()} accent={accent} />

          <Card>
            <Stat label="rating" icon="trending-up" value={data.rating} color={accent} />
            <Stat label="goal" icon="flag" value={settings.goalRating} />
            <Stat label="to go" icon="arrow-up-right" value={Math.max(0, settings.goalRating - data.rating)} />
            <Stat label="days left" icon="calendar" value={daysUntil(settings.goalDate, now)} />
            <Divider />
            <Stat label="solved today" icon="check-circle" value={`${done} / ${data.today.problems}`} />
            <Stat label="free today" icon="clock" value={hoursAndMinutes(data.today.minutes)} />
            <Stat label="focused today" icon="eye" value={hoursAndMinutes(focusedToday)} />
            <Divider />
            <Stat label="streak" icon="zap" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} color={accent} />
            <Stat label="best streak" icon="award" value={`${best} days`} />
            <Stat label="trees grown" icon="thumbs-up" value={trees.grown} />
          </Card>

          {!canRunGemma() ? (
            <Card>
              <Mono color={colors.muted}>gemma needs a phone with at least 6 GB of RAM, so focus has no hints on this one.</Mono>
            </Card>
          ) : !modelReady && (
            <Card>
              <Mono color={colors.muted}>gemma writes your hints during focus. it isn't on this phone yet.</Mono>
              {download === null ? (
                <Button label={`download gemma · ${MODEL_SIZE_LABEL}`} icon="download" onPress={getGemma} accent={accent} variant="outline" style={styles.top} />
              ) : (
                <Mono color={accent} style={styles.top}>downloading gemma · {Math.floor(download * 100)}%</Mono>
              )}
            </Card>
          )}

          <Card>
            <DayTrees target={data.today.problems} done={done} />
          </Card>

          <Card>
            <Mono color={colors.muted} size={12}>LAST {HEATMAP_WEEKS} WEEKS</Mono>
            <View style={styles.heatmap} accessibilityLabel={`solve activity, current streak ${streak} days`}>
              {heatmap(data.byDay, now, HEATMAP_WEEKS).map((week, w) => (
                <View key={w} style={styles.week}>
                  {week.map((count, d) => (
                    <View key={d} style={[styles.day, { backgroundColor: heatColor(count, accent) }]} />
                  ))}
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

/** Placeholder cards in the page's own shapes, for the very first load when nothing is saved yet. */
const Skeleton = () => (
  <SkeletonPulse label="loading today">
    <Card>
      <Bone width="30%" />
      <Bone width="70%" height={20} />
      <Bone width="20%" height={22} />
    </Card>
    <Bone width="100%" height={48} style={styles.boneButton} />
    <Card>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.boneRow}>
          <Bone width="35%" />
          <Bone width="15%" />
        </View>
      ))}
    </Card>
  </SkeletonPulse>
);

const styles = StyleSheet.create({
  boneButton: { borderRadius: radius },
  boneRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  content: { gap: 16, paddingBottom: 96 },
  fill: { flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  label: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 },
  grow: { flex: 1 },
  top: { marginTop: 12 },
  heatmap: { flexDirection: 'row', gap: 4, marginTop: 10 },
  week: { flex: 1, gap: 4 },
  day: { aspectRatio: 1, borderRadius: 3 },
});
