import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, tint, useTheme } from '../theme';
import type { GearItem, Trek } from '../treks';
import { Button, Text, useReducedMotion } from '../ui';

type Props = {
  /** The planned trek about to start; null hides the screen. */
  trek: Trek | null;
  onCancel: () => void;
  onGo: (gear: GearItem[]) => void;
};

/** Full-screen last check before a planned trek: tick off the checklist, then 3·2·1 and recording starts. */
export function PreflightScreen({ trek, onCancel, onGo }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [gear, setGear] = useState<GearItem[]>([]);
  const [count, setCount] = useState<number | null>(null);

  // Fresh ticks every time the screen opens
  useEffect(() => {
    setGear(trek ? trek.gear.map((g) => ({ ...g, packed: false })) : []);
    setCount(null);
  }, [trek]);

  // A ref, so a parent re-render (new onGo) never restarts the countdown
  const go = useRef(onGo);
  go.current = onGo;

  // 3 → 2 → 1 → start; leaving the screen cancels it
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      go.current(gear);
      return;
    }
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count, gear]);

  const missing = gear.filter((g) => !g.packed).length;
  const toggle = (name: string) => setGear((prev) => prev.map((g) => (g.name === name ? { ...g, packed: !g.packed } : g)));

  return (
    <Modal visible={trek !== null} animationType="slide" onRequestClose={count === null ? onCancel : () => setCount(null)}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Not yet" onPress={onCancel} style={styles.close}>
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text size={28} bold>
            Ready for {trek?.title}?
          </Text>
          <Text muted>
            {gear.length > 0 ? 'Tick off what you’ve packed.' : 'This trek has no checklist. Have a good walk.'}
          </Text>
          {gear.map((g) => (
            <Pressable
              key={g.name}
              accessibilityRole="checkbox"
              accessibilityLabel={g.name}
              accessibilityState={{ checked: g.packed }}
              onPress={() => toggle(g.name)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Feather name={g.packed ? 'check-square' : 'square'} size={24} color={g.packed ? colors.accent : colors.muted} />
              <Text size={18} muted={g.packed} style={[styles.flex, g.packed && styles.done]}>
                {g.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          {missing > 0 && (
            <Text size={13} color={colors.caution} center>
              {missing} {missing === 1 ? 'item' : 'items'} not packed
            </Text>
          )}
          <Button
            label={missing > 0 ? 'Start anyway' : 'Start trek'}
            icon="play"
            large
            onPress={() => setCount(3)}
          />
        </View>

        {count !== null && count > 0 && (
          <Countdown count={count} onCancel={() => setCount(null)} />
        )}
      </View>
    </Modal>
  );
}

function Countdown({ count, onCancel }: { count: number; onCancel: () => void }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 10, useNativeDriver: true }).start();
  }, [count, pop, reducedMotion]);

  return (
    <View style={[styles.countdown, { backgroundColor: colors.accent }]} accessibilityLiveRegion="assertive">
      <Animated.View
        accessible
        accessibilityLabel={`Starting in ${count}`}
        style={{
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.8, 3.2] }) }],
        }}
      >
        <Text size={28} bold color={colors.onAccent}>
          {count}
        </Text>
      </Animated.View>
      <Text size={18} bold color={colors.onAccent} style={styles.countLabel}>
        Starting your trek…
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel start"
        onPress={onCancel}
        style={[styles.cancel, { backgroundColor: tint(colors.onAccent, 18) }]}
      >
        <Text bold color={colors.onAccent}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
  footer: { paddingHorizontal: 20, gap: 10 },
  countdown: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 64 },
  countLabel: { marginTop: 24 },
  cancel: { position: 'absolute', bottom: 64, minHeight: 48, paddingHorizontal: 28, borderRadius: radius.pill, justifyContent: 'center' },
});
