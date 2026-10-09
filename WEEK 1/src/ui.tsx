import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { fonts, radius, tint, useTheme, type TypeSize } from './theme';
import { fitRoute, routePath, type Route } from './track';

export type IconName = React.ComponentProps<typeof Feather>['name'];

type TextProps = {
  children: React.ReactNode;
  size?: TypeSize;
  bold?: boolean;
  italic?: boolean;
  muted?: boolean;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Text({ children, size = 15, bold, italic, muted, color, center, style }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      style={[
        {
          fontFamily: bold ? fonts.semibold : italic ? fonts.italic : fonts.regular,
          fontSize: size,
          lineHeight: Math.round(size * 1.4),
          color: color ?? (muted ? colors.muted : colors.text),
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

/** Flat surface with a hairline border; Android elevation leaves grey slabs on rounded cards. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'filled' | 'outline' | 'plain';
  large?: boolean;
  disabled?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, icon, variant = 'filled', large, disabled, color, style }: ButtonProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.accent;
  const content = variant === 'filled' ? colors.onAccent : fill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        variant === 'filled' && { backgroundColor: fill },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon && <Feather name={icon} size={large ? 22 : 18} color={content} />}
      <Text size={large ? 18 : 15} bold color={content}>
        {label}
      </Text>
    </Pressable>
  );
}

export type DangerLevel = 'harmless' | 'caution' | 'dangerous' | 'uncertain';

const DANGER: Record<DangerLevel, { label: string; icon: IconName; token: 'harmless' | 'caution' | 'dangerous' }> = {
  harmless: { label: 'Harmless', icon: 'check-circle', token: 'harmless' },
  caution: { label: 'Caution', icon: 'alert-circle', token: 'caution' },
  dangerous: { label: 'Dangerous', icon: 'alert-triangle', token: 'dangerous' },
  uncertain: { label: 'Not sure', icon: 'help-circle', token: 'caution' },
};

/** Words for a danger level, for places that show only the icon. */
export const DANGER_LABEL: Record<DangerLevel, string> = {
  harmless: DANGER.harmless.label,
  caution: DANGER.caution.label,
  dangerous: DANGER.dangerous.label,
  uncertain: DANGER.uncertain.label,
};

/** The icon a danger level uses; the timeline shares it with badges. */
export const dangerIcon = (level: DangerLevel): IconName => DANGER[level].icon;

/** Which theme colour a danger level uses; maps share it with badges. */
export const DANGER_TOKEN: Record<DangerLevel, 'harmless' | 'caution' | 'dangerous'> = {
  harmless: 'harmless',
  caution: 'caution',
  dangerous: 'dangerous',
  uncertain: 'caution',
};

export function useDangerColor(level: DangerLevel): string {
  return useTheme().colors[DANGER[level].token];
}

/** Colour plus a text label, never colour alone. `solid` is for sitting on top of a photo. */
export function DangerBadge({ level, solid }: { level: DangerLevel; solid?: boolean }) {
  const { colors, isDark } = useTheme();
  const color = colors[DANGER[level].token];
  // Dark-mode danger colours are light, so solid badges need dark text there; light mode uses onAccent
  const fg = solid ? (isDark ? colors.background : colors.onAccent) : color;
  return (
    <View style={[styles.badge, { backgroundColor: solid ? color : tint(color, 15) }]}>
      <Feather name={DANGER[level].icon} size={15} color={fg} />
      <Text size={13} bold color={fg}>
        {DANGER[level].label}
      </Text>
    </View>
  );
}

/** Round tinted icon or letter avatar, used for section headers, empty states and avatars. */
export function IconBubble({
  icon,
  color,
  size = 40,
  letter,
}: {
  icon?: IconName;
  color: string;
  size?: number;
  letter?: string;
}) {
  return (
    <View style={[styles.bubble, { width: size, height: size, backgroundColor: tint(color, 15) }]}>
      {letter ? (
        <Text size={15} bold color={color}>
          {letter}
        </Text>
      ) : icon ? (
        <Feather name={icon} size={Math.round(size * 0.5)} color={color} />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reduced motion hook and animation components
// ---------------------------------------------------------------------------

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) setReduceMotion(enabled);
        })
        .catch(() => {});
    }

    const sub = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}

/**
 * Tab switch animation: incoming screen fades 0→1 and moves translateY 12→0 over 220 ms.
 */
export function TabTransition({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: true,
    }).start();
  }, [anim, reducedMotion]);

  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Push transition: incoming view fades in and moves translateX 24→0 over 220 ms.
 * Going back reverses the direction (-24→0).
 */
export function PushTransition({
  children,
  direction = 'forward',
  style,
}: {
  children: React.ReactNode;
  direction?: 'forward' | 'backward';
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: true,
    }).start();
  }, [anim, reducedMotion, direction]);

  const opacity = anim;
  const startX = direction === 'forward' ? 24 : -24;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, 0],
  });

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Feed card stagger animation: fade in and move up 8dp on first mount,
 * staggered 50 ms each, for the first 6 cards only.
 */
export function AnimatedFeedCard({
  children,
  index,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    const delay = Math.min(index, 5) * 50;
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [anim, index, reducedMotion]);

  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Navbar (PillNav, rewritten)
// ---------------------------------------------------------------------------

export type TabId = 'start' | 'community' | 'settings';

const TABS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: 'start', label: 'Home', icon: 'home' },
  { id: 'community', label: 'Community', icon: 'globe' },
  { id: 'settings', label: 'Profile', icon: 'user' },
];

// Icon-only and compact: three tabs don't need words, and the bar shouldn't cover the content
const TAB_SIZE = 48;
const NAV_PAD = 6;

export function PillNav({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const bottom = Math.max(useSafeAreaInsets().bottom, 12) + 12;
  const index = Math.max(0, TABS.findIndex((t) => t.id === active));
  const slide = useRef(new Animated.Value(index * TAB_SIZE)).current;

  useEffect(() => {
    if (reducedMotion) slide.setValue(index * TAB_SIZE);
    else Animated.spring(slide, { toValue: index * TAB_SIZE, speed: 20, bounciness: 6, useNativeDriver: true }).start();
  }, [index, reducedMotion, slide]);

  return (
    <View
      style={[
        styles.nav,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          // An outer drop shadow only, to lift the bar off the page; boxShadow, not elevation,
          // because Android elevation leaves grey slabs on rounded views
          boxShadow: isDark
            ? '0 12px 32px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.5)'
            : '0 12px 32px rgba(16,24,40,0.18), 0 2px 8px rgba(16,24,40,0.10)',
        },
      ]}
    >
      <Animated.View
        style={[
          styles.navIndicator,
          { backgroundColor: colors.accent, transform: [{ translateX: slide }] },
        ]}
      />
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [styles.tab, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
          >
            <Feather name={tab.icon} size={21} color={selected ? colors.onAccent : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled text field in Inter; the error shows as colour and text. */
export function Input({ label, error, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {label && <Text bold>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: error ? colors.dangerous : colors.border, color: colors.text },
        ]}
      />
      {error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={14} color={colors.dangerous} />
          <Text size={13} color={colors.dangerous}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A number with its label underneath, like a fitness app's summary row. */
export function Stat({ value, label, large }: { value: string; label: string; large?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text size={large ? 28 : 18} bold>
        {value}
      </Text>
      <Text size={13} muted>
        {label}
      </Text>
    </View>
  );
}

/** Small dot that breathes while something is recording. */
export function PulseDot({ color }: { color: string }) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [anim, reducedMotion]);
  return <Animated.View style={[styles.pulse, { backgroundColor: color, opacity: anim }]} />;
}

export type Checkpoint = {
  readonly kind: 'species' | 'scenery';
  readonly lat: number | null;
  readonly lng: number | null;
  readonly danger: DangerLevel;
};

/** Five-pointed star path centred on (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ') + ' Z';
}

/**
 * Route outline with start, finish and sightings as checkpoints, on a plain background. There are no
 * map tiles yet, and fake terrain would mislead, so the shape of the hike is all it claims to show.
 */
export function RouteMap({
  route,
  planned = [],
  checkpoints = [],
  height,
  live,
  label,
}: {
  route: Route;
  /** The route you meant to follow, drawn dashed underneath. */
  planned?: Route;
  checkpoints?: readonly Checkpoint[];
  height: number;
  live?: boolean;
  label: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  // Fit both lines, so walking off the plan never pushes either out of view
  const project = useMemo(() => fitRoute([...planned, ...route], width, height, 28), [planned, route, width, height]);
  const d = useMemo(() => routePath(route, project), [route, project]);
  const plannedD = useMemo(() => routePath(planned, project), [planned, project]);
  const start = route[0] ?? planned[0];
  const end = route[route.length - 1];

  const ring = (lat: number, lng: number, r: number, fill: string, key?: string | number) => {
    const { x, y } = project(lat, lng);
    return <Circle key={key} cx={x} cy={y} r={r} fill={fill} stroke={colors.surface} strokeWidth={3} />;
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.map, { height, backgroundColor: tint(colors.accent, 8) }]}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {/* A plain dot grid: texture without pretending to be terrain */}
          <Defs>
            <Pattern id="dots" width={14} height={14} patternUnits="userSpaceOnUse">
              <Circle cx={7} cy={7} r={1.1} fill={tint(colors.muted, 35)} />
            </Pattern>
          </Defs>
          <Rect width={width} height={height} fill="url(#dots)" />
          {planned.length > 1 && (
            <Path
              d={plannedD}
              stroke={colors.muted}
              strokeWidth={3}
              strokeDasharray="6 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          {route.length > 1 && (
            <>
              <Path d={d} stroke={colors.surface} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d={d} stroke={colors.accent} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
          {start &&
            (() => {
              // Hollow, so the start never reads as a harmless (green) checkpoint
              const { x, y } = project(start[0], start[1]);
              return <Circle cx={x} cy={y} r={6.5} fill={colors.surface} stroke={colors.accent} strokeWidth={4} />;
            })()}
          {end && route.length > 1 && !live && ring(end[0], end[1], 7, colors.text)}
          {/* Sightings sit on top of start and finish: they are what the map is for */}
          {checkpoints.map((c, i) => {
            if (c.lat === null || c.lng === null) return null;
            if (c.kind === 'species') return ring(c.lat, c.lng, 6, colors[DANGER[c.danger].token], i);
            // Views are stars, so shape alone tells them apart from species dots
            const { x, y } = project(c.lat, c.lng);
            return (
              <Path key={i} d={star(x, y, 9, 4)} fill={colors.text} stroke={colors.surface} strokeWidth={2} strokeLinejoin="round" />
            );
          })}
          {end && live && (
            <>
              {(() => {
                const { x, y } = project(end[0], end[1]);
                return <Circle cx={x} cy={y} r={16} fill={tint(colors.accent, 25)} />;
              })()}
              {ring(end[0], end[1], 8, colors.accent)}
            </>
          )}
        </Svg>
      )}
      {planned.length < 2 && (live ? route.length === 0 : route.length < 2) && (
        <View style={styles.mapEmpty}>
          <Feather name={live ? 'navigation' : 'map'} size={22} color={colors.muted} />
          <Text size={13} muted center>
            {live ? 'Waiting for GPS. Your route draws here as you walk.' : 'No route was recorded on this trek.'}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Profile photo, or the name's initial when there's no photo or it can't load (offline, deleted). */
export function Avatar({ uri, name, size = 36 }: { uri: string | null | undefined; name: string; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        accessibilityLabel={`${name}'s photo`}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }}
      />
    );
  }
  return <IconBubble letter={(name[0] ?? '?').toUpperCase()} color={colors.accent} size={size} />;
}

/** Label left, value right, hairlines between rows only: compact enough for a feed card. */
export function StatTable({ rows }: { rows: readonly (readonly [string, string])[] }) {
  const { colors } = useTheme();
  return (
    <View>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={[styles.statRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
        >
          <Text size={13} muted>
            {label}
          </Text>
          <Text size={13} bold>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Single-choice chips that wrap. Values are compared by content, since filter bands are objects. */
export function ChipGroup<T>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { label: string; value: T }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors } = useTheme();
  const same = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = same(o.value, selected);
        return (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(o.value)}
            style={[
              styles.chip,
              { backgroundColor: on ? colors.accent : colors.background, borderColor: on ? colors.accent : colors.border },
            ]}
          >
            <Text size={13} bold color={on ? colors.onAccent : colors.text}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Our own confirm dialog, so it matches the app instead of the system's. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable accessibilityLabel={cancelLabel} onPress={onCancel} style={styles.scrim}>
        {/* Swallow taps on the card so only the backdrop cancels */}
        <Pressable onPress={() => undefined} style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text size={18} bold>
            {title}
          </Text>
          <Text muted>{body}</Text>
          {/* Stacked, so long labels never wrap inside a half-width button */}
          <View style={styles.sheetButtons}>
            <Button label={confirmLabel} color={danger ? colors.dangerous : undefined} onPress={onConfirm} />
            <Button label={cancelLabel} variant="outline" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** First-launch and Settings safety copy, so the two never drift apart. */
export function SafetyInfo({ emergencyNumber }: { emergencyNumber: string }) {
  const { colors } = useTheme();
  return (
    <>
      <Card>
        <Text size={18} bold>
          Good to know
        </Text>
        <Tip icon="lock" title="Private by design" body="Everything runs on your phone. Your treks stay private unless you post one, and photos never leave." />
        <Tip icon="wifi-off" title="No signal needed" body="Identify anything and record your route, even in airplane mode." />
        <Tip
          icon="alert-triangle"
          title="Never eat what you find"
          body="TrailKit never says a wild plant is safe to eat. Many have poisonous look-alikes."
          color={colors.dangerous}
        />
      </Card>
      <Card>
        <Text size={18} bold>
          Safety
        </Text>
        <Text muted>
          TrailKit helps you learn what you see outdoors. It is not medical or foraging advice and never says a wild
          plant or mushroom is safe to eat. In an emergency, call {emergencyNumber}.
        </Text>
      </Card>
      <Card>
        <Text size={18} bold>
          Privacy
        </Text>
        <Text muted>
          Photos are identified on your phone by open-source AI models (BioCLIP and Gemma) and never uploaded. Your
          treks stay on your phone until you post one to Community; then only its route, totals and the names of what
          you found are shared.
        </Text>
      </Card>
    </>
  );
}

function Tip({ icon, title, body, color }: { icon: IconName; title: string; body: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.tip}>
      <IconBubble icon={icon} color={color ?? colors.accent} />
      <View style={styles.flex}>
        <Text bold>{title}</Text>
        <Text size={13} muted>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 24, gap: 12 },
  sheetButtons: { gap: 10, marginTop: 8 },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat: { flex: 1, gap: 2 },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  map: { borderRadius: 16, overflow: 'hidden' },
  mapEmpty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  tip: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  flex: { flex: 1 },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 12 },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLarge: { minHeight: 60 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  bubble: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  nav: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    padding: NAV_PAD,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navIndicator: {
    position: 'absolute',
    top: NAV_PAD,
    left: NAV_PAD,
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderRadius: TAB_SIZE / 2,
  },
  tab: { width: TAB_SIZE, height: TAB_SIZE, alignItems: 'center', justifyContent: 'center' },
});
