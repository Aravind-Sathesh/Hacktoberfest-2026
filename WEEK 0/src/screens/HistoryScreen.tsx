import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { CfError, problemId, userStatus } from '../cf';
import type { Settings } from '../settings';
import { type Solve, solvedHistory } from '../stats';
import { colors } from '../theme';
import { Card, Mono, PulsingLogo } from '../ui';

const pad = (n: number) => String(n).padStart(2, '0');
const ddmmyyyy = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

let cachedSolves: Solve[] | null = null;
let lastSettings: Settings | null = null;

/** Every problem he has solved, newest first. */
export function HistoryScreen({ settings }: { settings: Settings }) {
  const { handle, accent } = settings;
  const [solves, setSolves] = useState<Solve[] | null>(() => (lastSettings === settings ? cachedSolves : null));
  const [loading, setLoading] = useState(!cachedSolves || lastSettings !== settings);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const submissions = await userStatus(handle);
      const history = solvedHistory(submissions);
      cachedSolves = history;
      lastSettings = settings;
      setSolves(history);
    } catch (e) {
      setError(e instanceof CfError ? e.message : 'could not load solved problems');
    } finally {
      setLoading(false);
    }
  }, [handle, settings]);

  useEffect(() => {
    if (!cachedSolves || lastSettings !== settings) {
      refresh();
    }
  }, [refresh, settings]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, !solves && styles.fill]}
      refreshControl={<RefreshControl refreshing={loading && !!solves} onRefresh={refresh} colors={[accent]} />}
    >
      {error && <Mono color={colors.danger}>{error}</Mono>}
      {loading && !solves && <PulsingLogo />}

      {solves && (
        <>
          <Mono color={colors.muted} size={12}>SOLVED · {solves.length}</Mono>
          {solves.length === 0 ? (
            <Mono color={colors.muted}>nothing solved yet.</Mono>
          ) : (
            <Card>
              {solves.map(({ problem, at, attempts }) => (
                <View key={problemId(problem)} style={styles.row}>
                  <View style={styles.name}>
                    <Mono numberOfLines={1}>{problem.name}</Mono>
                    <Mono size={12} color={colors.muted}>{problemId(problem)}</Mono>
                  </View>
                  <View style={styles.meta}>
                    <Mono size={12} color={colors.muted}>{ddmmyyyy(at)}</Mono>
                    <Mono size={12} color={attempts === 1 ? accent : colors.muted}>
                      {attempts === 1 ? 'first try' : `${attempts} tries`}
                    </Mono>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 96 },
  fill: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  name: { flex: 1 },
  meta: { alignItems: 'flex-end' },
});
