import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius } from './theme';
import { Mono } from './ui';

type Props = { hints: string[]; accent: string };

// Long enough that a brush of the thumb doesn't spend a hint.
const HOLD_MS = 800;
const CARD_HEIGHT = 120;

/** Hints as a stack of cards: hold the top card to reveal the next, swipe back through the ones already seen. */
export function HintStack({ hints, accent }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [page, setPage] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const hold = useRef(new Animated.Value(0)).current;
  const locked = revealed < hints.length;

  const reveal = () => {
    hold.setValue(0);
    // The new hint takes the locked card's page, so the view stays put and shows it.
    setRevealed((n) => Math.min(n + 1, hints.length));
  };

  const startHold = () =>
    Animated.timing(hold, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start(
      ({ finished }) => finished && reveal(),
    );

  const cancelHold = () => {
    hold.stopAnimation();
    Animated.timing(hold, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const pages = revealed + (locked ? 1 : 0);

  return (
    <View style={styles.container} onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => cardWidth && setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}
      >
        {hints.slice(0, revealed).map((hint, i) => (
          <View key={i} style={[styles.page, { width: cardWidth }]}>
            <View style={[styles.card, styles.open]}>
              <Mono color={colors.muted} size={12}>
                HINT {i + 1} OF {hints.length}
              </Mono>
              <Mono>{hint}</Mono>
            </View>
          </View>
        ))}
        {locked && (
          <View style={[styles.page, { width: cardWidth }]}>
            {/* Cards peeking out underneath: what's left in the stack. */}
            {hints.length - revealed > 1 && <View style={[styles.card, styles.under]} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`hold to reveal hint ${revealed + 1}`}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={reveal}
              onPressIn={startHold}
              onPressOut={cancelHold}
              style={[styles.card, styles.closed]}
            >
              <Animated.View
                style={[
                  styles.fill,
                  { backgroundColor: accent, width: hold.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
              <Feather name="eye-off" size={18} color={colors.muted} />
              <Mono color={colors.muted}>
                hold to reveal hint {revealed + 1} of {hints.length}
              </Mono>
            </Pressable>
          </View>
        )}
      </ScrollView>
      {pages > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: pages }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === page ? accent : colors.border }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  page: { height: CARD_HEIGHT + 8, paddingTop: 8 },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radius,
    padding: 14,
    overflow: 'hidden',
  },
  open: { backgroundColor: colors.surface, gap: 6 },
  closed: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  under: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    backgroundColor: colors.border,
  },
  fill: { position: 'absolute', left: 0, bottom: 0, height: 3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
