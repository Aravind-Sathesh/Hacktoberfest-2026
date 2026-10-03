import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './theme';

/** Minutes of focus for a fully grown tree. */
export const FULL_GROWTH_MINUTES = 45;

const LEAF = ['#2ea043', '#3fb950', '#56d364'];
const DEAD_LEAF = ['#30363d', '#3d444d', '#484f58'];
const TRUNK = '#8b5a2b';
const DEAD_TRUNK = '#6e7681';

type Props = {
  /** 0 = just planted, 1 = fully grown. */
  growth: number;
  dead: boolean;
  size: number;
};

/** A tree drawn from plain views: a trunk that rises and a canopy that fills out with growth. */
export function Tree({ growth, dead, size }: Props) {
  const g = Math.min(1, Math.max(0, growth));
  const leaf = dead ? DEAD_LEAF : LEAF;
  const trunkHeight = size * (0.08 + 0.32 * g);
  const trunkWidth = size * (0.03 + 0.05 * g);
  const canopy = size * (0.1 + 0.42 * g);
  const groundY = size * 0.9;
  const trunkTop = groundY - trunkHeight;
  const centerX = size / 2;

  const circle = (diameter: number, dx: number, dy: number, color: string) => ({
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    left: centerX - diameter / 2 + dx,
    top: trunkTop - diameter * 0.75 + dy,
    backgroundColor: color,
  });

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={dead ? 'a dead tree' : `a tree, ${Math.round(g * 100)} percent grown`}
    >
      <View style={[styles.ground, { width: size * 0.7, left: size * 0.15, top: groundY - 6 }]} />
      {/* A dead tree leans over its roots; the ground stays level. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: `50% ${groundY}px`,
            transform: dead ? [{ rotate: '12deg' }] : [],
          },
        ]}
      >
        <View
          style={[
            styles.abs,
            {
              width: trunkWidth,
              height: trunkHeight,
              left: centerX - trunkWidth / 2,
              top: trunkTop,
              borderRadius: trunkWidth / 2,
              backgroundColor: dead ? DEAD_TRUNK : TRUNK,
            },
          ]}
        />
        {g < 0.15 ? (
          // A sprout: two small leaves on the stem.
          <>
            <View
              style={[
                styles.abs,
                styles.leaf,
                {
                  left: centerX - size * 0.07,
                  top: trunkTop - size * 0.03,
                  backgroundColor: leaf[1],
                  transform: [{ rotate: '-30deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.abs,
                styles.leaf,
                {
                  left: centerX,
                  top: trunkTop - size * 0.05,
                  backgroundColor: leaf[2],
                  transform: [{ rotate: '30deg' }],
                },
              ]}
            />
          </>
        ) : (
          <>
            <View style={[styles.abs, circle(canopy * 0.75, -canopy * 0.38, canopy * 0.3, leaf[0])]} />
            <View style={[styles.abs, circle(canopy * 0.75, canopy * 0.38, canopy * 0.3, leaf[0])]} />
            <View style={[styles.abs, circle(canopy, 0, 0, leaf[1])]} />
            <View style={[styles.abs, circle(canopy * 0.55, -canopy * 0.12, -canopy * 0.32, leaf[2])]} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  ground: {
    position: 'absolute',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  leaf: { width: 28, height: 14, borderRadius: 14 },
});
