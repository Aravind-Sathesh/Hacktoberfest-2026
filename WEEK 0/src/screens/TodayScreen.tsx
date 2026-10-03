import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { todaysBusyBlocks } from '../calendar';
import { CfError, type Problem, type RatingChange, isSolved, problemId, problemset, upcomingContests, userRating, userStatus } from '../cf';
import { MODEL_SIZE_LABEL, canRunGemma, downloadModel, isDownloading, isModelDownloaded } from '../gemma';
import { type Today, candidates, dailyTarget, pickDeterministic, recentContestId, shortlist, upsolve, withoutTags } from '../plan';
import { DayTrees } from '../DayTrees';
import { type Session, forest, loadSessions } from '../sessions';
import { type Settings, daysUntil } from '../settings';
import { heatmap, solvesByDay, streaks } from '../stats';
import { colors } from '../theme';
import { Button, Card, Chip, Divider, Mono, PulsingLogo, Stat } from '../ui';

type Props = { settings: Settings; onFocus: (problem: Problem) => void };

type Loaded = {
  rating: number;
  today: Today;
  queue: Problem[];
  solved: Set<string>;
  byDay: Map<string, number>;
  sessions: Session[];
};

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

const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

async function buildQueue(
  settings: Settings,
  now: Date,
  rating: number,
  today: Today,
  solved: Set<string>,
  ratingChanges: RatingChange[],
): Promise<Problem[]> {
  const problems = withoutTags(await problemset(), settings.excludedTags);
  const contestId = recentContestId(ratingChanges, now);
  const upsolves = contestId ? upsolve(contestId, problems, solved).slice(0, today.problems) : [];
  const options = shortlist(candidates(problems, solved, rating));
  return [...upsolves, ...pickDeterministic(options, options.length)];
}

async function load(settings: Settings): Promise<Loaded> {
  const now = new Date();
  // The last rating change is the current rating, which saves a user.info call (2s of rate limit).
  const ratingChanges = await userRating(settings.handle);
  const rating = ratingChanges.at(-1)?.newRating ?? UNRATED_START;
  const submissions = await userStatus(settings.handle);
  const solved = new Set(submissions.filter(isSolved).map((s) => problemId(s.problem)));
  const sessions = await loadSessions();
  for (const s of sessions) {
    if (s.outcome === 'grown') solved.add(s.problemId);
  }
  const busy = await todaysBusyBlocks(now).catch(() => []);
  const today = dailyTarget(now, busy, await upcomingContests(), settings.targets);
  const queue = await buildQueue(settings, now, rating, today, solved, ratingChanges);

  return { rating, today, queue, solved, byDay: solvesByDay(submissions), sessions };
}

const heatColor = (count: number, accent: string) =>
  count < 0 ? 'transparent' : count === 0 ? colors.border : `${accent}${count === 1 ? '66' : count <= 3 ? 'b3' : 'ff'}`;

export function TodayScreen({ settings, onFocus }: Props) {
  const [data, setData] = useState<Loaded | null>(() => cacheFor(settings));
  const [loading, setLoading] = useState(!cacheFor(settings) || stale);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [download, setDownload] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(isModelDownloaded());
  const accent = settings.accent;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSkipped(0);
    try {
      const loaded = await load(settings);
      cachedData = loaded;
      lastSettings = settings;
      cachedDay = new Date().toDateString();
      stale = false;
      setData(loaded);
    } catch (e) {
      setError(e instanceof CfError ? e.message : 'something broke while planning. pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    if (!cacheFor(settings) || stale) {
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
  const unsolved = (problems: Problem[]) => (data ? problems.filter((p) => !data.solved.has(problemId(p))) : []);
  const todo = unsolved(data?.queue ?? []);
  const current = todo.length ? todo[skipped % todo.length] : undefined;
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
      {loading && !data && <PulsingLogo />}

      {data && (
        <>
          <Card>
            <Mono color={colors.muted} size={12}>
              {current ? `PROBLEM ${done + 1}` : 'TODAY'}
              {data.today.contestToday ? ' · CONTEST DAY' : ''}
            </Mono>
            {current ? (
              <>
                <Mono bold size={20}>{current.name}</Mono>
                <View style={styles.chips}>
                  <Chip label={String(current.rating ?? 'unrated')} color={accent} />
                  <Chip label={problemId(current)} />
                  {settings.showTags && current.tags.map((t) => <Chip key={t} label={t} />)}
                </View>
                <View style={styles.actions}>
                  <Button label="start focus" icon="play" onPress={() => onFocus(current)} accent={accent} style={styles.grow} />
                  {todo.length > 1 && (
                    <Button label="skip" icon="skip-forward" iconOnly onPress={() => setSkipped((n) => n + 1)} accent={accent} variant="outline" />
                  )}
                </View>
              </>
            ) : (
              <Mono bold size={18}>
                nothing planned today.
              </Mono>
            )}
          </Card>

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

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 96 },
  fill: { flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  grow: { flex: 1 },
  top: { marginTop: 12 },
  heatmap: { flexDirection: 'row', gap: 4, marginTop: 10 },
  week: { flex: 1, gap: 4 },
  day: { aspectRatio: 1, borderRadius: 3 },
});
