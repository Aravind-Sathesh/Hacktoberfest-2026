import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Animated, BackHandler, Pressable, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_400Regular_Italic,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import type { Problem } from './src/cf';
import { FocusScreen } from './src/screens/FocusScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen, forgetToday } from './src/screens/TodayScreen';
import { type Settings, loadSettings } from './src/settings';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { arrivedFromThemeSwitch, colors, onThemeFade } from './src/theme';
import type { IconName } from './src/ui';

type Tab = 'today' | 'history' | 'settings';
type Screen = { name: Tab } | { name: 'focus'; problem?: Problem };

const TABS: { name: Tab; icon: IconName }[] = [
  { name: 'today', icon: 'home' },
  { name: 'history', icon: 'clock' },
  { name: 'settings', icon: 'settings' },
];

type NavPillProps = { active: Tab; accent: string; onSelect: (tab: Tab) => void };

function NavPill({ active, accent, onSelect }: NavPillProps) {
  return (
    <View style={styles.pill} accessibilityRole="tablist">
      {TABS.map(({ name, icon }) => (
        <Pressable
          key={name}
          accessibilityRole="tab"
          accessibilityLabel={name}
          accessibilityState={{ selected: name === active }}
          onPress={() => onSelect(name)}
          style={[styles.tab, name === active && { backgroundColor: accent }]}
        >
          <Feather name={icon} size={18} color={name === active ? colors.background : colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

/** A full-screen veil in the theme's background colour: it fades in before a theme switch and out after it. */
function ThemeFade({ ready }: { ready: boolean }) {
  const [color, setColor] = useState(colors.background);
  const veil = useRef(new Animated.Value(arrivedFromThemeSwitch ? 1 : 0)).current;

  useEffect(() => {
    // Android's window behind the app matches the theme, so nothing shows through at startup or on reload.
    setBackgroundColorAsync(colors.background);
    onThemeFade(
      (to) =>
        new Promise((done) => {
          setColor(to);
          Animated.timing(veil, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => done());
        }),
    );
  }, [veil]);

  // Lift the veil only once the app has drawn, so the new theme fades in rather than popping in under it.
  useEffect(() => {
    if (ready && arrivedFromThemeSwitch) Animated.timing(veil, { toValue: 0, duration: 500, useNativeDriver: true }).start();
  }, [ready, veil]);

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: veil }]} />;
}

export default function Root() {
  const [ready, setReady] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.topBar} />
      <App onReady={() => setReady(true)} />
      <ThemeFade ready={ready} />
    </View>
  );
}

function App({ onReady }: { onReady: () => void }): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({ JetBrainsMono_400Regular, JetBrainsMono_400Regular_Italic, JetBrainsMono_700Bold });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'today' });
  const goToday = useCallback(() => setScreen({ name: 'today' }), []);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'today' || screen.name === 'focus' || !settings?.handle) return false;
      goToday();
      return true;
    });
    return () => sub.remove();
  }, [screen, settings, goToday]);

  const loaded = fontsLoaded && settings !== null;
  useEffect(() => {
    if (loaded) onReady();
  }, [loaded, onReady]);

  if (!fontsLoaded || !settings) return null;

  const onSaved = (next: Settings) => {
    setSettings(next);
    goToday();
  };

  if (!settings.handle) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SettingsScreen settings={settings} onSaved={onSaved} />
      </View>
    );
  }

  if (screen.name === 'focus') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <FocusScreen problem={screen.problem} handle={settings.handle} accent={settings.accent} showRating={settings.showRatings} onDone={goToday} onGrown={forgetToday} />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.tabs]}>
      <StatusBar style="light" />
      <View style={styles.page}>
        {screen.name === 'settings' ? (
          <SettingsScreen settings={settings} onSaved={onSaved} />
        ) : screen.name === 'history' ? (
          <HistoryScreen settings={settings} />
        ) : (
          <TodayScreen settings={settings} onFocus={(problem) => setScreen({ name: 'focus', problem })} />
        )}
      </View>
      <NavPill active={screen.name} accent={settings.accent} onSelect={(name) => setScreen({ name })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // Pitch black band over the camera cutout and status bar, in every theme, with a little breathing room below.
  topBar: { height: (RNStatusBar.currentHeight ?? 24) + 6, backgroundColor: '#000000' },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 16,
    paddingHorizontal: 20,
    // Clears the gesture bar under edge-to-edge.
    paddingBottom: 24,
  },
  // Pages run under the floating pill, so they pad their own bottoms instead.
  tabs: { paddingBottom: 0 },
  page: { flex: 1 },
  pill: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    // Solid, no blur: a steady dark grey reads the same over any page.
    backgroundColor: colors.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
