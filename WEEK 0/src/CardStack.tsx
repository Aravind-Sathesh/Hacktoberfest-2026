import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from './theme';

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  /** Read out when the stacked edges are focused, e.g. "next problem". */
  nextLabel: string;
};

const PEEK = 14;
const MAX_PEEKING = 3;
// Cards further back are narrower and darker, which reads as depth without shadows.
const INSET = 8;
const BACK_GREYS = ['#262c36', '#1f242c', '#1a1e25'];
// A drag shorter than this springs back; past it the card flies off.
const SWIPE_DISTANCE = 80;
const NUDGE = 44;
// Once per app launch, not every time Today comes back into view.
let nudged = false;

/**
 * Wallet-style stack: the front card in full, the ones behind as edges above it.
 * Swipe the front card left for the next one and right for the previous; tapping the edges also goes next.
 */
export function CardStack<T>({ items, keyOf, renderCard, nextLabel }: Props<T>) {
  // The front card sizes itself to its content; the cards behind and the stack follow it.
  const [cardHeight, setCardHeight] = useState(0);
  const [front, setFront] = useState(0);
  const count = items.length;
  const peeking = Math.min(count - 1, MAX_PEEKING);

  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(0);

  const step = (dir: 1 | -1) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFront((f) => (f + dir + count) % count);
  };
  // The responder is made once, so it reaches the current count through a ref.
  const stepRef = useRef(step);
  stepRef.current = step;

  // Before paint, so the card that flew off is never drawn back in place.
  useLayoutEffect(() => x.setValue(0), [front, x]);

  useEffect(() => {
    if (nudged || count < 2) return;
    nudged = true;
    // A peek left (next) then right (previous), so he learns the card slides without reading a hint.
    const to = (toValue: number, duration: number) => Animated.timing(x, { toValue, duration, useNativeDriver: false });
    Animated.sequence([
      Animated.delay(700),
      to(-NUDGE, 260),
      to(0, 220),
      Animated.delay(150),
      to(NUDGE, 260),
      to(0, 220),
    ]).start();
  }, [count, x]);

  const springBack = () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
  const pan = useRef(
    PanResponder.create({
      // Only clearly sideways drags; vertical ones stay with the page's scroll, and taps reach the button.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < SWIPE_DISTANCE) return springBack();
        const dir = g.dx < 0 ? 1 : -1;
        Animated.timing(x, { toValue: -dir * width.current, duration: 160, useNativeDriver: false }).start(() =>
          stepRef.current(dir),
        );
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  // Drawn back to front: the furthest card first, at the top.
  const behind = Array.from({ length: peeking }, (_, i) => peeking - i);
  const at = (offset: number) => items[(front + offset) % count];

  return (
    <View style={{ height: cardHeight + peeking * PEEK }} onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
      {behind.map((depth) => (
        <View
          key={keyOf(at(depth))}
          style={[
            styles.card,
            styles.back,
            {
              height: cardHeight,
              top: (peeking - depth) * PEEK,
              left: depth * INSET,
              right: depth * INSET,
              backgroundColor: BACK_GREYS[depth - 1],
            },
          ]}
        />
      ))}
      <Animated.View
        key={keyOf(at(0))}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h === cardHeight) return;
          // Animate only changes between cards, not the first measurement.
          if (cardHeight) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCardHeight(h);
        }}
        {...(count > 1 ? pan.panHandlers : {})}
        style={[
          styles.card,
          styles.front,
          {
            top: peeking * PEEK,
            transform: [
              { translateX: x },
              { rotate: x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-6deg', '0deg', '6deg'] }) },
            ],
          },
        ]}
      >
        {renderCard(at(0))}
      </Animated.View>
      {peeking > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          onPress={() => step(1)}
          hitSlop={{ top: Math.max(0, 44 - peeking * PEEK) }}
          style={[styles.edges, { height: peeking * PEEK }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
  },
  back: { borderColor: '#ffffff10' },
  front: { padding: 16, gap: 4, borderColor: colors.border },
  edges: { position: 'absolute', top: 0, left: 0, right: 0 },
});
