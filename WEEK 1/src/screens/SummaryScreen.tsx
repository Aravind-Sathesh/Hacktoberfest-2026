import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { commonName, dayLabel, timeOfDay } from '../format';
import { radius, tint, useTheme } from '../theme';
import { formatDistance, formatElevation, pace } from '../track';
import { useUnits } from '../units';
import { duration, speciesSummary, type Trek } from '../treks';
import { Button, Card, DANGER_LABEL, DANGER_TOKEN, dangerIcon, IconBubble, type IconName, StatTable, Text } from '../ui';
import { TrailMap } from '../trailmap';

type Props = {
  topInset: number;
  trek: Trek;
  backLabel?: string;
  onBack: () => void;
  onSetShared: (shared: boolean) => void;
  /** Someone else's post: copy its route into a new plan. */
  onPlanRoute?: () => void;
};

/** A finished trek as a journal page: the route with its checkpoints, totals, and everything found. */
export function SummaryScreen({ topInset, trek, backLabel = 'Treks', onBack, onSetShared, onPlanRoute }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const { colors } = useTheme();
  const startedAt = trek.startedAt ?? 0;
  const endedAt = trek.endedAt ?? startedAt;
  const { species, dangerous } = speciesSummary(trek.sightings);
  const views = trek.sightings.filter((s) => s.kind === 'scenery');
  const units = useUnits();
  const trekPace = pace(trek.distanceM, endedAt - startedAt, units);

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${backLabel}`} onPress={onBack} style={styles.back}>
        <Feather name="arrow-left" size={20} color={colors.text} />
        <Text bold>{backLabel}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.spread}>
          <Text size={13} muted>
            {dayLabel(startedAt, Date.now())} · {timeOfDay(startedAt)} to {timeOfDay(endedAt)}
          </Text>
        </View>
        <Text size={28} bold>
          {trek.title}
        </Text>
      </View>

      <TrailMap
        route={trek.route}
        planned={trek.plannedRoute}
        checkpoints={trek.sightings}
        height={260}
        label={`Route map, ${formatDistance(trek.distanceM, units)}, ${trek.sightings.length} sightings pinned`}
      />
      <View style={styles.legend}>
        <Legend color={colors.accent} label="Start" hollow />
        <Legend color={colors.text} label="Finish" />
        <Legend color={colors.caution} label="Species (coloured by danger)" />
        {views.length > 0 && (
          <View style={styles.legendItem}>
            <Feather name="star" size={13} color={colors.text} />
            <Text size={13} muted>
              View
            </Text>
          </View>
        )}
      </View>

      <Card>
        <StatTable
          rows={[
            ['Distance', formatDistance(trek.distanceM, units)],
            ['Time', duration(startedAt, endedAt)],
            ['Climbed', formatElevation(trek.elevationGainM, units)],
            ['Pace', trekPace ?? '–'],
          ]}
        />
      </Card>

      {trek.author === null && !trek.sample && (
        <Card style={trek.shared ? undefined : { borderColor: tint(colors.accent, 45) }}>
          <View style={styles.row}>
            <IconBubble icon={trek.shared ? 'users' : 'lock'} color={trek.shared ? colors.accent : colors.muted} />
            <View style={styles.flex}>
              <Text bold>{trek.shared ? 'Posted to Community' : 'Only you can see this trek'}</Text>
              <Text size={13} muted>
                {trek.shared
                  ? 'Other hikers see the route, totals and what you found. Your photos stay on your phone.'
                  : 'Recommended: post it so other hikers can plan this route. Your photos stay on your phone.'}
              </Text>
            </View>
          </View>
          {trek.shared ? (
            <Button label="Make private again" icon="lock" variant="outline" onPress={() => onSetShared(false)} />
          ) : (
            <Button label="Post to Community" icon="users" onPress={() => onSetShared(true)} />
          )}
        </Card>
      )}

      <Card>
        <Text size={18} bold>
          Along the way
        </Text>
        <Text size={13} muted>
          {species.length === 0
            ? 'Nothing was identified on this trek.'
            : `${species.length} species${dangerous > 0 ? `, ${dangerous} dangerous` : ''}`}
          {views.length > 0 ? ` · ${views.length} ${views.length === 1 ? 'view' : 'views'}` : ''}
        </Text>
        <Timeline trek={trek} onOpenPhoto={setPhoto} />
      </Card>

      {onPlanRoute && trek.route.length > 1 && (
        <Button label="Copy this route" icon="copy" onPress={onPlanRoute} />
      )}

      <Modal visible={photo !== null} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable accessibilityLabel="Close photo" onPress={() => setPhoto(null)} style={styles.viewer}>
          {photo && <Image source={{ uri: photo }} style={styles.full} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/**
 * The trek as a vertical line, top to bottom: start, every sighting and view in order, finish.
 * Each stop is a notch on the line with its time and, when there is one, a photo to tap.
 */
function Timeline({ trek, onOpenPhoto }: { trek: Trek; onOpenPhoto: (uri: string) => void }) {
  const { colors } = useTheme();
  const stops = [...trek.sightings].sort((a, b) => a.takenAt - b.takenAt);
  const rows: { key: string; time: number; node: React.ReactNode; icon: IconName; color: string; said: string }[] = [
    { key: 'start', time: trek.startedAt ?? 0, node: <Text bold>Start</Text>, icon: 'play', color: colors.accent, said: 'Start' },
    ...stops.map((s) => ({
      key: String(s.takenAt),
      time: s.takenAt,
      icon: s.kind === 'scenery' ? ('star' as const) : dangerIcon(s.danger),
      color: s.kind === 'scenery' ? colors.text : colors[DANGER_TOKEN[s.danger]],
      said: s.kind === 'scenery' ? 'View' : `${commonName(s.label)}, ${DANGER_LABEL[s.danger]}`,
      node: (
        <View style={styles.stop}>
          <View style={styles.flex}>
            {/* The notch's icon (shape and colour) carries the danger level; the label reads it out */}
            <Text bold>{s.kind === 'scenery' ? 'View' : commonName(s.label)}</Text>
          </View>
          {s.photoUri ? (
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open photo" onPress={() => onOpenPhoto(s.photoUri)}>
              <Image source={{ uri: s.photoUri }} style={styles.thumb} />
            </Pressable>
          ) : null}
        </View>
      ),
    })),
    { key: 'end', time: trek.endedAt ?? 0, node: <Text bold>Finish</Text>, icon: 'flag', color: colors.text, said: 'Finish' },
  ];

  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.key} style={styles.tlRow}>
          <View style={styles.rail}>
            <View style={[styles.railLine, { backgroundColor: i === 0 ? 'transparent' : colors.accent }]} />
            <View style={[styles.notch, { backgroundColor: colors.surface, borderColor: r.color }]}>
              <Feather name={r.icon} size={13} color={r.color} />
            </View>
            <View style={[styles.railLine, styles.flex, { backgroundColor: i === rows.length - 1 ? 'transparent' : colors.accent }]} />
          </View>
          <View style={[styles.tlBody, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View accessible accessibilityLabel={`${timeOfDay(r.time)}, ${r.said}`}>
              <Text size={13} muted>
                {timeOfDay(r.time)}
              </Text>
              {r.node}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          hollow ? { backgroundColor: colors.surface, borderWidth: 3, borderColor: color } : { backgroundColor: color },
        ]}
      />
      <Text size={13} muted>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, alignSelf: 'flex-start' },
  header: { gap: 4 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: -4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  tlRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 28, alignItems: 'center' },
  railLine: { width: 3, minHeight: 8 },
  notch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tlBody: { flex: 1, marginLeft: 12, paddingVertical: 10, gap: 4 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  full: { width: '100%', height: '80%' },
  flex: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
