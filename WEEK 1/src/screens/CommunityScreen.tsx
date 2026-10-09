import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeCount,
  applyFilters,
  climbSteps,
  DEFAULT_FILTERS,
  distanceFrom,
  distanceSteps,
  proximitySteps,
  SORTS,
  TIME_STEPS,
  type Here,
  type PostFilters,
} from '../community';
import { radius, useTheme } from '../theme';
import { formatDistance } from '../track';
import { whereAmI } from '../tracking';
import type { Trek } from '../treks';
import { useUnits } from '../units';
import { AnimatedFeedCard, Button, Card, ChipGroup, Text } from '../ui';
import { DoneCard } from './TrekCards';

type Props = {
  topInset: number;
  userName: string;
  userPhoto: string | null;
  /** Your posted treks first, then everyone else's. */
  posts: readonly Trek[];
  /** One line when Community can't be reached; the samples and your own posts still show. */
  error: string | null;
  filters: PostFilters;
  onChangeFilters: (filters: PostFilters) => void;
  onOpen: (post: Trek) => void;
};

/** Routes hikers chose to post. Every trek starts private; this is only what was shared. */
export function CommunityScreen({ topInset, userName, userPhoto, posts, error, filters, onChangeFilters, onOpen }: Props) {
  const { colors } = useTheme();
  const units = useUnits();
  const insets = useSafeAreaInsets();
  const [now] = useState(Date.now());
  const [here, setHere] = useState<Here>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const needsLocation = filters.sort === 'nearest' || filters.within !== null;

  // Only ask for location once someone sorts or filters by it
  useEffect(() => {
    if (needsLocation && !here) whereAmI().then(setHere);
  }, [needsLocation, here]);

  const shown = useMemo(() => applyFilters(posts, filters, here), [posts, filters, here]);
  const count = activeCount(filters);
  const sortLabel = SORTS.find((s) => s.value === filters.sort)?.label ?? 'Newest';

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + 4 }]}>
      <View>
        <Text size={28} bold>
          Community
        </Text>
        <Text muted>Routes other hikers shared, and what they found on them.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${sortLabel}, ${count} filters on`}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [
          styles.filterBar,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="sliders" size={18} color={colors.text} />
        <Text bold style={styles.flex}>
          {sortLabel}
        </Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text size={13} bold color={colors.onAccent}>
              {count} {count === 1 ? 'filter' : 'filters'}
            </Text>
          </View>
        )}
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      {error && (
        <View style={styles.errorRow}>
          <Feather name="wifi-off" size={14} color={colors.muted} />
          <Text size={13} muted style={styles.flex}>
            {error}
          </Text>
        </View>
      )}

      {needsLocation && !here && (
        <Text size={13} muted>
          Turn on location to sort by distance from you.
        </Text>
      )}

      {shown.length === 0 && (
        <Card>
          <Text bold>No routes match</Text>
          <Button label="Clear filters" icon="x" variant="outline" onPress={() => onChangeFilters(DEFAULT_FILTERS)} />
        </Card>
      )}

      {shown.map((post, index) => {
        const away = distanceFrom(post, here);
        return (
          <AnimatedFeedCard key={post.id} index={index}>
            <DoneCard
              trek={post}
              userName={userName}
              userPhoto={userPhoto}
              now={now}
              away={away === null ? undefined : `${formatDistance(away, units)} away`}
              onOpen={() => onOpen(post)}
            />
          </AnimatedFeedCard>
        );
      })}

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable accessibilityLabel="Close filters" onPress={() => setSheetOpen(false)} style={styles.scrim}>
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: 24 + insets.bottom }]}>
              <Section title="Sort by">
                <ChipGroup options={SORTS} selected={filters.sort} onSelect={(sort) => onChangeFilters({ ...filters, sort })} />
              </Section>
              <Section title="Distance from you">
                <ChipGroup
                  options={proximitySteps(units)}
                  selected={filters.within}
                  onSelect={(within) => onChangeFilters({ ...filters, within })}
                />
              </Section>
              <Section title="Length">
                <ChipGroup
                  options={distanceSteps(units)}
                  selected={filters.distance}
                  onSelect={(distance) => onChangeFilters({ ...filters, distance })}
                />
              </Section>
              <Section title="Time">
                <ChipGroup options={TIME_STEPS} selected={filters.minutes} onSelect={(minutes) => onChangeFilters({ ...filters, minutes })} />
              </Section>
              <Section title="Climb">
                <ChipGroup
                  options={climbSteps(units)}
                  selected={filters.climb}
                  onSelect={(climb) => onChangeFilters({ ...filters, climb })}
                />
              </Section>
              <View style={styles.sheetButtons}>
                <Button label="Reset" variant="outline" onPress={() => onChangeFilters(DEFAULT_FILTERS)} style={styles.flex} />
                <Button label={`Show ${shown.length}`} onPress={() => setSheetOpen(false)} style={styles.flex} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text bold>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 112, gap: 16 },
  flex: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetBody: { padding: 20, gap: 20 },
  section: { gap: 10 },
  sheetButtons: { flexDirection: 'row', gap: 12 },
});
