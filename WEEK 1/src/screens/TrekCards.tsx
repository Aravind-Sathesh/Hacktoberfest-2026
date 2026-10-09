import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { dayLabel, timeOfDay } from '../format';
import { useTheme } from '../theme';
import { formatDistance, formatElevation } from '../track';
import { useUnits } from '../units';
import { duration, nextDays, speciesSummary, type Trek } from '../treks';
import { Avatar, Button, Card, RouteMap, StatTable, Text } from '../ui';

/** Who on the left; when on the right. Your own treks carry a small private/posted mark by your name. */
/** Who on the left; when on the right. Your own treks carry a small private/posted mark by your name. */
function Author({ trek, userName, userPhoto, when }: { trek: Trek; userName: string; userPhoto: string | null; when: string }) {
  const { colors } = useTheme();
  const mine = trek.author === null;
  return (
    <View style={styles.spread}>
      <View style={styles.author}>
        <Avatar uri={mine ? userPhoto : trek.authorAvatar} name={trek.author ?? userName} size={32} />
        <Text bold>{trek.author ?? 'You'}</Text>
        {mine && trek.status === 'done' && (
          <View accessible accessibilityLabel={trek.shared ? 'Posted to Community' : 'Private'}>
            <Feather name={trek.shared ? 'users' : 'lock'} size={14} color={colors.muted} />
          </View>
        )}
      </View>
      <Text size={13} muted>
        {when}
      </Text>
    </View>
  );
}


/** Strava-style: who and when, the totals, the route outline, then what was found. */
export function DoneCard({
  trek,
  userName,
  userPhoto,
  now,
  onOpen,
  action,
  away,
}: {
  trek: Trek;
  userName: string;
  userPhoto: string | null;
  now: number;
  onOpen?: () => void;
  action?: React.ReactNode;
  /** "12 km away", when we know where you are. */
  away?: string;
}) {
  const { colors } = useTheme();
  const units = useUnits();
  const { species, dangerous } = speciesSummary(trek.sightings);
  const views = trek.sightings.filter((s) => s.kind === 'scenery').length;
  const startedAt = trek.startedAt ?? 0;
  const body = (
    <Card>
      <Author
        trek={trek}
        userName={userName}
        userPhoto={userPhoto}
        when={away ? `${away} · ${dayLabel(startedAt, now)}` : `${dayLabel(startedAt, now)} · ${timeOfDay(startedAt)}`}
      />
      <Text size={18} bold>
        {trek.title}
      </Text>
      <StatTable
        rows={[
          ['Distance', formatDistance(trek.distanceM, units)],
          ['Time', duration(trek.startedAt, trek.endedAt)],
          ['Climbed', formatElevation(trek.elevationGainM, units)],
        ]}
      />
      {trek.route.length > 1 && (
        <RouteMap
          route={trek.route}
          planned={trek.plannedRoute}
          checkpoints={trek.sightings}
          height={170}
          label={`Route map of ${trek.title}: ${species.length} species found${dangerous > 0 ? `, ${dangerous} dangerous` : ''}${views > 0 ? `, ${views} views` : ''}`}
        />
      )}
      {action}
    </Card>
  );
  if (!onOpen) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trek.title}, open trek`}
      onPress={onOpen}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function PlannedCard({
  trek,
  userName,
  userPhoto,
  now,
  blocked,
  onStart,
}: {
  trek: Trek;
  userName: string;
  userPhoto: string | null;
  now: number;
  blocked: boolean;
  onStart: () => void;
}) {
  const { colors } = useTheme();
  const units = useUnits();
  const when = nextDays(now, 14).find((d) => d.iso === trek.plannedFor)?.label ?? trek.plannedFor ?? 'Some day';
  return (
    <Card>
      <Author trek={trek} userName={userName} userPhoto={userPhoto} when={`Planned for ${when}`} />
      <Text size={18} bold>
        {trek.title}
      </Text>
      {trek.plannedRoute.length > 1 && (
        <RouteMap
          route={[]}
          planned={trek.plannedRoute}
          height={140}
          label={`Planned route for ${trek.title}, ${formatDistance(trek.distanceM, units)}`}
        />
      )}
      <Text size={13} muted>
        {trek.gear.length > 0
          ? `Checklist: ${trek.gear.map((g) => g.name).join(', ')}`
          : 'No checklist for this trek.'}
      </Text>
      {blocked ? (
        <Text size={13} muted>
          Finish your current trek first.
        </Text>
      ) : (
        <Button label="Start this trek" icon="play" onPress={onStart} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  flex: { flex: 1 },
});
