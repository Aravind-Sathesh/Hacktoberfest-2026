import React, { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { BackHandler, Pressable, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
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
import { colors } from './src/theme';
import type { IconName } from './src/ui';

type Tab = 'today' | 'history' | 'settings';
type Screen = { name: Tab } | { name: 'focus'; problem?: Problem };

const TABS: { name: Tab; icon: IconName }[] = [
  { name: 'today', icon: 'home' },
  { name: 'history', icon: 'clock' },
  { name: 'settings', icon: 'settings' },
];

type NavPillProps = { active: Tab; accent: string; onSelect: (tab: Tab) => void; behind: RefObject<View | null> };

function NavPill({ active, accent, onSelect, behind }: NavPillProps) {
  return (
    <BlurView
      blurTarget={behind}
      blurMethod="dimezisBlurViewSdk31Plus"
      tint="dark"
      intensity={60}
      style={styles.pill}
      accessibilityRole="tablist"
    >
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
    </BlurView>
  );
}

export default function App(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({ JetBrainsMono_400Regular, JetBrainsMono_400Regular_Italic, JetBrainsMono_700Bold });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'today' });
  const page = useRef<View>(null);
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
      <BlurTargetView ref={page} style={styles.page}>
        {screen.name === 'settings' ? (
          <SettingsScreen settings={settings} onSaved={onSaved} />
        ) : screen.name === 'history' ? (
          <HistoryScreen settings={settings} />
        ) : (
          <TodayScreen settings={settings} onFocus={(problem) => setScreen({ name: 'focus', problem })} />
        )}
      </BlurTargetView>
      <NavPill active={screen.name} accent={settings.accent} onSelect={(name) => setScreen({ name })} behind={page} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: (RNStatusBar.currentHeight ?? 24) + 16,
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
    // A heavy black tint over the blur keeps the icons readable over anything, the bright heatmap included.
    backgroundColor: '#000000cc',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
