import { reloadAppAsync } from 'expo';
import { File, Paths } from 'expo-file-system';
import { setBackgroundColorAsync } from 'expo-system-ui';

const DARK = {
  background: '#0d1117',
  surface: '#161b22',
  foreground: '#f0f6fc',
  muted: '#8b949e',
  border: '#30363d',
  danger: '#f87171',
  pill: '#21262d',
  /** The cards behind the front one in a stack, nearest first. */
  stack: ['#262c36', '#1f242c', '#1a1e25'],
};

/** True black for OLED screens: the background switches its pixels off, and cards sit just above it. */
const AMOLED: typeof DARK = {
  ...DARK,
  background: '#000000',
  surface: '#0c0c0c',
  border: '#222222',
  pill: '#141414',
  stack: ['#1c1c1c', '#151515', '#101010'],
};

// A file rather than AsyncStorage: styles are built when each module loads, so the palette has to be known
// synchronously, before any of them. Switching it reloads the app so every style is built again.
const amoledFlag = new File(Paths.document, 'amoled');

// Left by a theme switch so the fresh start fades in from the new background instead of popping in.
const fadeFlag = new File(Paths.document, 'theme-fade');

const exists = (file: File) => {
  try {
    return file.exists;
  } catch {
    return false;
  }
};

export const isAmoled = exists(amoledFlag);

export const colors = isAmoled ? AMOLED : DARK;

/** True once, on the start right after a theme switch. */
export const arrivedFromThemeSwitch = exists(fadeFlag);
if (arrivedFromThemeSwitch) fadeFlag.delete();

let fadeOut: ((to: string) => Promise<void>) | null = null;

/** The app's root registers how to fade the screen to a colour before the switch reloads it. */
export const onThemeFade = (fade: (to: string) => Promise<void>) => {
  fadeOut = fade;
};

/**
 * Fades to the new theme's background, makes Android's own window that colour too (so the reload never
 * flashes anything else), then reloads; the new start fades in from that same colour.
 */
export async function setAmoled(on: boolean) {
  const next = on ? AMOLED : DARK;
  await fadeOut?.(next.background);
  await setBackgroundColorAsync(next.background);
  if (on) amoledFlag.write('1');
  else if (amoledFlag.exists) amoledFlag.delete();
  fadeFlag.write('1');
  await reloadAppAsync('theme changed');
}

export const fonts = {
  regular: 'JetBrainsMono_400Regular',
  italic: 'JetBrainsMono_400Regular_Italic',
  bold: 'JetBrainsMono_700Bold',
} as const;

export const radius = 14;
