import { Feather } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { radius, tint, useTheme } from '../theme';
import { duration, feed, type Profile, type Trek } from '../treks';
import { AnimatedFeedCard, Button, Card, IconBubble, PulseDot, Text } from '../ui';
import { DoneCard, PlannedCard } from './TrekCards';

type Props = {
  topInset: number;
  profile: Profile;
  treks: readonly Trek[];
  onPlanTrek: () => void;
  onStartNow: () => void;
  onResumeTrek: () => void;
  onStartPlannedTrek: (trekId: string) => void;
  onOpenTrek: (trekId: string) => void;
  onBrowseCommunity: () => void;
};

export function ExploreScreen({
  topInset,
  profile,
  treks,
  onPlanTrek,
  onStartNow,
  onResumeTrek,
  onStartPlannedTrek,
  onOpenTrek,
  onBrowseCommunity,
}: Props) {
  const { colors } = useTheme();
  const network = useNetworkState();
  // Unknown (null) counts as online: only claim "offline" when the phone says so
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeTrek = treks.find((t) => t.status === 'active');
  const list = feed(treks).filter((t) => t.status !== 'active');

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + 4 }]}>
      <View style={styles.spread}>
        <View style={styles.flex}>
          <Text size={28} bold>
            Hi, {profile.name}
          </Text>
          <Text muted>{activeTrek ? 'You’re out on the trail.' : 'Ready for the trail?'}</Text>
        </View>
        {offline && (
          <View
            accessible
            accessibilityLabel="No connection. Tracking and identifying still work."
            style={[styles.offline, { backgroundColor: tint(colors.muted, 15) }]}
          >
            <Feather name="wifi-off" size={18} color={colors.muted} />
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeTrek ? `Resume ${activeTrek.title}` : 'Start a trek now'}
        onPress={activeTrek ? onResumeTrek : onStartNow}
        style={({ pressed }) => [styles.hero, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[styles.heroIcon, { backgroundColor: tint(colors.onAccent, 18) }]}>
          {activeTrek ? <PulseDot color={colors.onAccent} /> : <Feather name="play" size={24} color={colors.onAccent} />}
        </View>
        <View style={styles.flex}>
          <Text size={13} bold color={colors.onAccent}>
            {activeTrek ? `On the trail · ${duration(activeTrek.startedAt, now)}` : 'Head out now'}
          </Text>
          <Text size={18} bold color={colors.onAccent}>
            {activeTrek ? activeTrek.title : 'Start a trek'}
          </Text>
          <Text size={13} color={colors.onAccent}>
            {activeTrek ? 'Tap to see your route and identify things.' : 'Records your route and what you find, all offline.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={24} color={colors.onAccent} />
      </Pressable>

      {!activeTrek && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan a trek"
          onPress={onPlanTrek}
          style={({ pressed }) => [
            styles.planRow,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <IconBubble icon="map" color={colors.accent} size={44} />
          <View style={styles.flex}>
            <Text bold>Plan a trek</Text>
            <Text size={13} muted>
              Pick a route, a day and what to bring
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
      )}

      <View style={[styles.spread, styles.sectionHeader]}>
        <Text size={18} bold>
          Your treks
        </Text>
        <Text size={13} muted>
          {list.length}
        </Text>
      </View>

      {list.length === 0 && (
        <Card>
          <Text bold>No treks yet</Text>
          <Text size={13} muted>
            Start one now, or find a route in Community and plan it for another day.
          </Text>
          <Button label="Browse Community" icon="users" variant="outline" onPress={onBrowseCommunity} />
        </Card>
      )}

      {list.map((t, index) => (
        <AnimatedFeedCard key={t.id} index={index}>
          {t.status === 'planned' ? (
            <PlannedCard
              trek={t}
              userName={profile.name}
              userPhoto={profile.photoUri}
              now={now}
              blocked={activeTrek !== undefined}
              onStart={() => onStartPlannedTrek(t.id)}
            />
          ) : (
            <DoneCard trek={t} userName={profile.name}
              userPhoto={profile.photoUri} now={now} onOpen={() => onOpenTrek(t.id)} />
          )}
        </AnimatedFeedCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 16 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  offline: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: radius.card, minHeight: 112 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  sectionHeader: { marginTop: 8 },
});
