import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { commonName, timeOfDay } from '../format';
import { radius, tint, useTheme } from '../theme';
import { clock, formatDistance, formatElevation, isOffRoute, pace, simplify, trackStats, type TrackPoint } from '../track';
import { useUnits } from '../units';
import { readTrack } from '../tracking';
import type { Trek } from '../treks';
import { Button, Card, ConfirmSheet, DangerBadge, IconBubble, PulseDot, Stat, Text } from '../ui';
import { TrailMap } from '../trailmap';

type Props = {
  topInset: number;
  trek: Trek;
  trackingError: string | null;
  error: string | null;
  onTakePhoto: () => void;
  onPickPhoto: () => void;
  onSaveView: () => void;
  onEndTrek: () => void;
  onGoHome: () => void;
};

// The GPS task writes to a file; re-reading it this often is cheap and keeps one source of truth
const TRACK_REFRESH_MS = 5000;

/** The trek being recorded: live route, stats, identify, and what's been found so far. */
export function TrekScreen({
  topInset,
  trek,
  trackingError,
  error,
  onTakePhoto,
  onPickPhoto,
  onSaveView,
  onEndTrek,
  onGoHome,
}: Props) {
  const { colors } = useTheme();
  const units = useUnits();
  const [now, setNow] = useState(Date.now());
  const since = trek.startedAt ?? 0;
  const [points, setPoints] = useState<TrackPoint[]>(() => readTrack(since));

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const track = setInterval(() => setPoints(readTrack(since)), TRACK_REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(track);
    };
  }, [since]);

  const stats = useMemo(() => trackStats(points), [points]);
  // Same rule as the background alert, so the banner and the notification always agree
  const [offRoute, setOffRoute] = useState(false);
  useEffect(() => {
    setOffRoute((was) => isOffRoute(points.slice(-2), trek.plannedRoute, was));
  }, [points, trek.plannedRoute]);
  const route = useMemo(() => simplify(points, 300), [points]);
  const elapsed = now - (trek.startedAt ?? now);
  const currentPace = pace(stats.distanceM, elapsed, units);
  const newestFirst = [...trek.sightings].reverse();

  const [confirming, setConfirming] = useState(false);

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={onGoHome} style={styles.back}>
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text bold>Home</Text>
        </Pressable>
        <View style={[styles.recording, { backgroundColor: tint(colors.dangerous, 12) }]}>
          <PulseDot color={colors.dangerous} />
          <Text size={13} bold color={colors.dangerous}>
            On the trail
          </Text>
        </View>
      </View>

      <Text size={28} bold>
        {trek.title}
      </Text>

      {offRoute && (
        <View
          accessibilityRole="alert"
          style={[styles.offRoute, { backgroundColor: tint(colors.caution, 14), borderColor: tint(colors.caution, 45) }]}
        >
          <Feather name="alert-triangle" size={18} color={colors.caution} />
          <View style={styles.flex}>
            <Text bold color={colors.caution}>
              You’ve left your planned route
            </Text>
            <Text size={13} color={colors.caution}>
              The dashed line is the route you planned. Head back towards it.
            </Text>
          </View>
        </View>
      )}

      <TrailMap
        route={route}
        planned={trek.plannedRoute}
        checkpoints={trek.sightings}
        height={220}
        live
        label={`Your route so far, ${formatDistance(stats.distanceM, units)}`}
      />

      <Card>
        <View style={styles.statsRow}>
          <Stat value={clock(elapsed)} label="Time" large />
        </View>
        <View style={styles.statsRow}>
          <Stat value={formatDistance(stats.distanceM, units)} label="Distance" />
          <Stat value={formatElevation(stats.elevationGainM, units)} label="Climbed" />
          <Stat value={currentPace ?? '–'} label="Pace" />
        </View>
      </Card>

      {trackingError && (
        <Card style={{ backgroundColor: tint(colors.caution, 10), borderColor: tint(colors.caution, 35) }}>
          <View style={styles.row}>
            <Feather name="map-pin" size={18} color={colors.caution} />
            <Text style={styles.flex} color={colors.caution}>
              {trackingError}
            </Text>
          </View>
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <IconBubble icon="camera" color={colors.accent} size={44} />
          <View style={styles.flex}>
            <Text size={18} bold>
              Spotted something?
            </Text>
            <Text size={13} muted>
              Identify a plant, insect or snake to see if it's safe, or save a view. Both get pinned on your route.
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <Button label="Identify" icon="camera" onPress={onTakePhoto} style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from gallery"
            onPress={onPickPhoto}
            style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="image" size={20} color={colors.accent} />
          </Pressable>
        </View>
        <Button label="Save a view" icon="sunrise" variant="outline" onPress={onSaveView} />
        {error && (
          <View style={styles.row}>
            <Feather name="alert-circle" size={16} color={colors.dangerous} />
            <Text size={13} color={colors.dangerous} style={styles.flex}>
              Couldn't identify that photo. {error}
            </Text>
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.spread}>
          <Text size={18} bold>
            On this trek
          </Text>
          <Text size={13} muted>
            {trek.sightings.length}
          </Text>
        </View>
        {newestFirst.length === 0 ? (
          <Text size={13} muted>
            Nothing yet. What you identify and the views you save show up here and on the map.
          </Text>
        ) : (
          newestFirst.map((s) => (
            <View key={s.takenAt} style={styles.sighting}>
              {s.kind === 'scenery' ? (
                <View style={[styles.viewTag, { backgroundColor: tint(colors.text, 10) }]}>
                  <Feather name="star" size={15} color={colors.text} />
                  <Text size={13} bold>
                    View
                  </Text>
                </View>
              ) : (
                <DangerBadge level={s.danger} />
              )}
              <Text style={styles.flex}>{s.kind === 'scenery' ? 'Saved a view' : commonName(s.label)}</Text>
              <Text size={13} muted>
                {timeOfDay(s.takenAt)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button label="End trek" icon="flag" variant="outline" color={colors.dangerous} onPress={() => setConfirming(true)} />
      <ConfirmSheet
        visible={confirming}
        title="End this trek?"
        body="Your route, what you found and your views are saved. It stays private until you post it."
        confirmLabel="End trek"
        cancelLabel="Keep going"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onEndTrek();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  statsRow: { flexDirection: 'row', gap: 12 },
  offRoute: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1 },
  iconButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sighting: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  viewTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
});
