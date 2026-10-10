import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from './theme';

type MonoProps = {
  children: React.ReactNode;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  style?: TextStyle;
  numberOfLines?: number;
};

export function Mono({ children, color = colors.foreground, bold, italic, size = 14, style, numberOfLines }: MonoProps) {
  const fontFamily = bold ? fonts.bold : italic ? fonts.italic : fonts.regular;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color, fontSize: size, lineHeight: size * 1.4, fontFamily }, style]}
    >
      {children}
    </Text>
  );
}

export type IconName = React.ComponentProps<typeof Feather>['name'];

type ButtonProps = {
  /** Without a label the button is icon-only; the label then still names it for screen readers. */
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  onPress: () => void;
  accent: string;
  variant?: 'filled' | 'outline';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, icon, iconOnly, onPress, accent, variant = 'filled', disabled, style }: ButtonProps) {
  const filled = variant === 'filled';
  const tint = filled ? colors.background : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        iconOnly && styles.iconOnly,
        filled ? { backgroundColor: accent } : { borderColor: colors.border, borderWidth: 1 },
        (pressed || disabled) && { opacity: 0.5 },
        style,
      ]}
    >
      {icon && <Feather name={icon} size={18} color={tint} />}
      {!iconOnly && (
        <Mono bold color={tint}>
          {label}
        </Mono>
      )}
    </Pressable>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.card, style]}>{children}</View>
);

type WipeProps = { value: string | number; children: React.ReactNode; cover?: string };

/**
 * Wipes its text in when `value` changes (never on the first draw): a cover in the colour behind it shrinks
 * away left to right. Only what changed moves, so a refresh shows exactly which numbers are new.
 */
export function WipeOnChange({ value, children, cover = colors.surface }: WipeProps) {
  const first = useRef(true);
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [value, reveal]);
  return (
    <View>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: cover,
            transformOrigin: 'right',
            transform: [{ scaleX: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
          },
        ]}
      />
    </View>
  );
}

type StatProps = { label: string; value: string | number; icon: IconName; color?: string };

export const Stat = ({ label, value, icon, color }: StatProps) => (
  <View style={styles.stat}>
    <View style={styles.statLabel}>
      <Feather name={icon} size={15} color={colors.muted} />
      <Mono color={colors.muted}>{label}</Mono>
    </View>
    <WipeOnChange value={value}>
      <Mono bold color={color}>
        {value}
      </Mono>
    </WipeOnChange>
  </View>
);

export const Chip = ({ label, color = colors.muted }: { label: string; color?: string }) => (
  <View style={[styles.chip, { borderColor: color }]}>
    <Mono size={12} color={color}>
      {label}
    </Mono>
  </View>
);

type FieldProps = { label: string; value: string; onChangeText: (text: string) => void; numeric?: boolean };

export function Field({ label, value, onChangeText, numeric }: FieldProps) {
  return (
    <View style={styles.stat}>
      <Mono color={colors.muted}>{label}</Mono>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

export const Divider = () => <View style={styles.divider} />;

/** The app mark, grey and breathing, while something loads. */
/** Gently pulses placeholder content while the real thing loads. */
export function SkeletonPulse({ children, label }: { children: React.ReactNode; label: string }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.skeleton, { opacity }]} accessibilityLabel={label}>
      {children}
    </Animated.View>
  );
}

/** A grey placeholder bar standing in for text or a control. */
export const Bone = ({ width, height = 12, style }: { width: `${number}%`; height?: number; style?: ViewStyle }) => (
  <View style={[styles.bone, { width, height }, style]} />
);

type DialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A destructive confirmation; tapping outside or pressing back cancels. */
export function Dialog({ visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: DialogProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
        <Card style={styles.dialog}>
          <Mono bold size={18}>{title}</Mono>
          <Mono color={colors.muted}>{message}</Mono>
          <View style={styles.dialogButtons}>
            <Button label={cancelLabel} onPress={onCancel} accent={colors.foreground} variant="outline" style={styles.dialogButton} />
            <Button label={confirmLabel} onPress={onConfirm} accent={colors.danger} style={styles.dialogButton} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconOnly: { width: 48, paddingHorizontal: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius, padding: 16, gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  input: {
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 14,
    minWidth: 130,
    textAlign: 'right',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  skeleton: { gap: 16 },
  bone: { backgroundColor: colors.border, borderRadius: 6, marginVertical: 4 },
  scrim: { flex: 1, backgroundColor: '#000000b3', justifyContent: 'center', padding: 24 },
  dialog: { gap: 8, padding: 20, borderWidth: 1, borderColor: colors.border },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dialogButton: { flex: 1 },
});
