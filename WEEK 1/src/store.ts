import { Directory, File, Paths } from 'expo-file-system';
import { EMPTY_STATE, parseState, type AppState } from './treks';

const STATE_NAME = 'trailkit.json';
const SIGHTINGS_DIR = new Directory(Paths.document, 'sightings');

/**
 * Saved profile and treks. No file means a fresh install. An unreadable file is moved aside
 * (never overwritten) so a bad read can't wipe someone's treks.
 */
export async function loadState(): Promise<AppState> {
  const file = new File(Paths.document, STATE_NAME);
  if (!file.exists) return EMPTY_STATE;
  const state = parseState(await file.text());
  if (state) return state;
  file.moveSync(new File(Paths.document, `trailkit-unreadable-${Date.now()}.json`));
  throw new Error('Your saved treks couldn’t be read. A copy was kept on your phone.');
}

/** Writes a temp file and moves it into place, so a crash mid-write leaves the old file intact. */
export function saveState(state: AppState): void {
  try {
    const tmp = new File(Paths.document, `${STATE_NAME}.tmp`);
    tmp.write(JSON.stringify(state));
    tmp.moveSync(new File(Paths.document, STATE_NAME), { overwrite: true });
  } catch (err) {
    console.warn('[store] Failed to save state:', err);
  }
}

/** Removes everything personal from the phone: profile, treks and their photos. The AI models stay. */
export function wipeLocalData(): void {
  for (const f of [new File(Paths.document, STATE_NAME), new File(Paths.document, `${STATE_NAME}.tmp`)]) {
    if (f.exists) f.delete();
  }
  if (SIGHTINGS_DIR.exists) SIGHTINGS_DIR.delete();
}

/** The image picker's file lives in a cache Android may clear, so keep our own copy. */
export function keepPhoto(uri: string, takenAt: number): string {
  try {
    if (!SIGHTINGS_DIR.exists) SIGHTINGS_DIR.create();
    const dest = new File(SIGHTINGS_DIR, `${takenAt}.jpg`);
    new File(uri).copySync(dest);
    return dest.uri;
  } catch (err) {
    console.warn('[store] could not keep photo:', err);
    return uri;
  }
}
