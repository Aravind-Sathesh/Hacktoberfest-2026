import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import goldTree from '../assets/tree-gold.png';
import tree from '../assets/tree.png';
import { colors } from './theme';
import { Mono, WipeOnChange } from './ui';

const GREEN = '#3fb950';
// Solves past the day's target.
const GOLD = '#e3b341';
const SIZE = 40;

/** One circle per problem in today's target, green once solved; extra solves add gold circles. */
export function DayTrees({ target, done }: { target: number; done: number }) {
  const extra = Math.max(0, done - target);
  const color = (i: number) => (i >= done ? colors.border : i < target ? GREEN : GOLD);

  return (
    <View style={styles.container}>
      <WipeOnChange value={`${done}/${target}`}>
        <Mono color={colors.muted} size={12}>
          TODAY · {done} OF {target}
        </Mono>
      </WipeOnChange>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessible
        accessibilityLabel={`${done} of ${target} problems solved today`}
      >
        {Array.from({ length: target + extra }, (_, i) => (
          <View key={i} style={[styles.circle, { borderColor: color(i) }]}>
            <Image source={i >= target && i < done ? goldTree : tree} style={[styles.tree, i >= done && styles.unsolved]} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { gap: 10 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tree: { width: 26, height: 26 },
  unsolved: { filter: [{ grayscale: 1 }], opacity: 0.35 },
});
