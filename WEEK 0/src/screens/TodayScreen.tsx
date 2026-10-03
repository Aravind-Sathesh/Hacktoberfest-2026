import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { todaysBusyBlocks } from '../calendar';
import { CfError, type Problem, type RatingChange, isSolved, problemId, problemset, upcomingContests, userRating, userStatus } from '../cf';
import { MODEL_SIZE_LABEL, canRunGemma, downloadModel, isDownloading, isModelDownloaded } from '../gemma';
import { type Today, candidates, dailyTarget, pickDeterministic, recentContestId, shortlist, upsolve, withoutTags } from '../plan';
import { CardStack } from '../CardStack';
import { DayTrees } from '../DayTrees';
import { type Session, forest, loadSessions } from '../sessions';
import { type Settings, daysUntil } from '../settings';
import { heatmap, solvesByDay, streaks } from '../stats';
import { colors } from '../theme';
import { Button, Card, Chip, Divider, Mono, PulsingLogo, Stat } from '../ui';

/** No problem means he picks it on the focus screen. */
type Props = { settings: Settings; onFocus: (problem?: Problem) => void };

type Loaded = {
  rating: number;
  today: Today;
  plan: Problem[];
  solved: Set<string>;
  byDay: Map<string, number>;
  sessions: Session[];
};

// The day's suggestions are picked once and kept, so a refresh never reshuffles them.
type DayPlan = { day: string; handle: string; excludedTags: string; perTarget: number; problems: Problem[] };

const PLAN_KEY = 'plan';
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

const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

async function buildPlan(
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
  return [...upsolves, ...pickDeterministic(options, SUGGESTIONS_PER_TARGET * today.problems - upsolves.length)];
}

// A calendar change can move the target mid-day; that alone never reshuffles the suggestions.
async function todaysPlan(settings: Settings, pick: () => Promise<Problem[]>): Promise<Problem[]> {
  const key = { day: new Date().toDateString(), handle: settings.handle, excludedTags: [...settings.excludedTags].sort().join(), perTarget: SUGGESTIONS_PER_TARGET };
  const stored = await AsyncStorage.getItem(PLAN_KEY);
  const plan = stored ? (JSON.parse(stored) as DayPlan) : null;
  if (plan && plan.day === key.day && plan.handle === key.handle && plan.excludedTags === key.excludedTags && plan.perTarget === key.perTarget)
    return plan.problems;
  const problems = await pick();
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify({ ...key, problems }));
  return problems;
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
  const plan = await todaysPlan(settings, () => buildPlan(settings, now, rating, today, solved, ratingChanges));

  return { rating, today, plan, solved, byDay: solvesByDay(submissions), sessions };
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
      {loading && !data && <PulsingLogo />}

      {data && (
        <>
          {suggestions.length ? (
            <CardStack
              items={suggestions}
              keyOf={problemId}
              nextLabel="next suggested problem"
              renderCard={(p) => (
                <>
                  <Mono color={colors.muted} size={12}>
                    SUGGESTED · {suggestions.indexOf(p) + 1} OF {suggestions.length}
                    {data.today.contestToday ? ' · CONTEST DAY' : ''}
                  </Mono>
                  <View style={styles.cardRow}>
                    <View style={styles.grow}>
                      <Mono bold size={18} numberOfLines={2}>{p.name}</Mono>
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

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 96 },
  fill: { flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 },
  grow: { flex: 1 },
  top: { marginTop: 12 },
  heatmap: { flexDirection: 'row', gap: 4, marginTop: 10 },
  week: { flex: 1, gap: 4 },
  day: { aspectRatio: 1, borderRadius: 3 },
});
