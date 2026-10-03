import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import deadTree from '../assets/tree-stages/tree-0-dead.png';
import stage1 from '../assets/tree-stages/stage-1-seed.png';
import stage2 from '../assets/tree-stages/stage-2-sprout.png';
import stage3 from '../assets/tree-stages/stage-3-seedling.png';
import stage4 from '../assets/tree-stages/stage-4-sapling.png';
import stage5 from '../assets/tree-stages/stage-5-young-tree.png';
import stage6 from '../assets/tree-stages/stage-6-tree.png';
import stage7 from '../assets/tree-stages/stage-7-big-tree.png';
import stage8 from '../assets/tree-stages/stage-8-full-tree.png';

/** Minutes of focus for a fully grown tree. */
export const FULL_GROWTH_MINUTES = 80;

// Drawn on one shared canvas and ground line, so swapping stages grows the tree in place.
const STAGES = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8];

/** Which of the eight stages to show: a new one every tenth of the way, the last at full growth. */
export const stageFor = (growth: number) => Math.min(STAGES.length - 1, Math.floor(Math.max(0, growth) * STAGES.length));

type Props = {
  /** 0 = just planted, 1 = fully grown. */
  growth: number;
  dead: boolean;
  size: number;
};

export function Tree({ growth, dead, size }: Props) {
  const stage = stageFor(growth);
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={dead ? 'a dead tree' : `a tree, stage ${stage + 1} of ${STAGES.length}`}
    >
      <Image source={dead ? deadTree : STAGES[stage]} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
