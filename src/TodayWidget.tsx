import React from 'react';
import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import goldTree from '../assets/tree-gold.png';
import tree from '../assets/tree.png';
import { dailyTarget } from './plan';
import { heatmap } from './stats';
import type { WidgetData } from './widgetData';

const GREEN = '#3fb950';
// Solves past the day's target, as in the app's tree row.
const GOLD = '#e3b341';
const EMPTY = '#30363d';
const BACKGROUND = '#0d1117';
const MUTED = '#8b949e';
const PADDING = 14;
const COLUMN_GAP = 12;
// The widget keeps this much history; see WIDGET_DAYS.
const MAX_WEEKS = 30;
// The share of each grid step that is cell rather than gap.
const CELL_FILL = 0.78;
// Degrees left open between ring segments.
const SEGMENT_GAP = 14;

const point = (cx: number, r: number, degrees: number) => {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cx + r * Math.sin(rad)).toFixed(2)}`;
};

/** One arc per problem of the day's target, green once solved; solves past it add gold arcs. */
export function ringSvg(target: number, done: number): string {
  const segments = Math.max(target, done, 1);
  const size = 100;
  const r = 42;
  const c = size / 2;
  const gap = segments > 1 ? SEGMENT_GAP : 0;
  const sweep = 360 / segments;
  const arcs = Array.from({ length: segments }, (_, i) => {
    const color = i >= done ? EMPTY : i < target ? GREEN : GOLD;
    const start = i * sweep + gap / 2;
    const end = (i + 1) * sweep - gap / 2;
    // A single full circle can't be one arc command, so it's drawn as a circle.
    if (segments === 1) return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="8"/>`;
    return `<path d="M ${point(c, r, start)} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${point(c, r, end)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${arcs.join('')}</svg>`;
}

/** What the ring shows while a tap-refresh is fetching: widgets can't animate, so it's a still spinner. */
export const spinnerSvg = (accent: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="${EMPTY}" stroke-width="8"/><path d="M 50 20 A 30 30 0 1 1 20 50" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></svg>`;

/**
 * The streak grid: one column per week, oldest on the left, shaded like the app's. Drawn in 10-unit steps
 * and sized explicitly, because without a width and height the renderer draws it small inside its box.
 */
export function gridSvg(weeks: number[][], accent: string, width: number, height: number): string {
  const step = 10;
  const cell = step * CELL_FILL;
  const cells = weeks.flatMap((week, w) =>
    week.flatMap((count, d) => {
      if (count < 0) return [];
      const fill = count === 0 ? EMPTY : accent;
      const opacity = count === 0 ? 1 : count === 1 ? 0.4 : count <= 3 ? 0.7 : 1;
      return [`<rect x="${w * step}" y="${d * step}" width="${cell}" height="${cell}" rx="1.5" fill="${fill}" fill-opacity="${opacity}"/>`];
    }),
  );
  const viewBox = `0 0 ${weeks.length * step - (step - cell)} ${7 * step - (step - cell)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${cells.join('')}</svg>`;
}

/** Today's count and target. The saved target is only today's; on a new day it falls back to the plain daily target. */
export function widgetToday(data: WidgetData, now: Date): { done: number; target: number } {
  const today = now.toDateString();
  const done = data.solves.find(([day]) => day === today)?.[1] ?? 0;
  const target = data.day === today ? data.target : dailyTarget(now, [], [], data.targets).problems;
  return { done, target };
}

type Props = { data: WidgetData | null; now: Date; width: number; height: number; loading?: boolean };

/**
 * One tile high: the streak grid as wide as fits and the ring as tall as the widget. Tapping the ring
 * redraws the widget; tapping anywhere else opens the app. Sized from the widget's real dimensions in dp.
 */
export function TodayWidget({ data, now, width, height, loading }: Props) {
  // Tighter on a short widget so the content keeps most of the height.
  const padding = Math.round(Math.min(PADDING, height * 0.16));
  const frame = {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    backgroundColor: BACKGROUND as `#${string}`,
    borderRadius: 22,
    paddingHorizontal: PADDING,
    paddingVertical: padding,
  };
  if (!data) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ ...frame, justifyContent: 'center' }}>
        <TextWidget text="open codeforces buddy once to fill this in." style={{ fontSize: 12, color: MUTED, fontFamily: 'JetBrainsMono_400Regular' }} />
      </FlexWidget>
    );
  }
  const { done, target } = widgetToday(data, now);
  const inner = Math.max(24, height - 2 * padding);
  const ring = inner;
  const step = inner / 7;
  const gridRoom = width - 2 * PADDING - ring - COLUMN_GAP;
  const weeks = Math.min(MAX_WEEKS, Math.max(4, Math.floor((gridRoom + step * (1 - CELL_FILL)) / step)));
  const gridWidth = Math.round(weeks * step - step * (1 - CELL_FILL));
  const treeSize = Math.round(ring * 0.5);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...frame, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <SvgWidget
        svg={gridSvg(heatmap(new Map(data.solves), now, weeks), data.accent, gridWidth, Math.round(inner))}
        style={{ width: gridWidth, height: Math.round(inner) }}
      />
      <OverlapWidget clickAction="REFRESH" style={{ width: ring, height: ring }}>
        <SvgWidget svg={ringSvg(target, done)} style={{ width: ring, height: ring }} />
        <FlexWidget style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <SvgWidget svg={spinnerSvg(data.accent)} style={{ width: treeSize, height: treeSize }} />
          ) : (
            // A day past the target earns the gold tree.
            <ImageWidget image={done > target ? goldTree : tree} imageWidth={treeSize} imageHeight={treeSize} />
          )}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}
