import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { cleanTrack, isOffRoute, parseTrack, type TrackPoint } from './track';
import { parseState } from './treks';

const TRACK_TASK = 'trailkit-track';
// One file for the trek being recorded; it is read and cleared when the trek ends
const TRACK_FILE = new File(Paths.document, 'active_track.jsonl');

type TaskData = { locations: Location.LocationObject[] };

// Must run at import time (index.ts) so Android can wake the task with the app closed
TaskManager.defineTask<TaskData>(TRACK_TASK, async ({ data, error }) => {
  if (error || !data) {
    if (error) console.warn('[tracking] update failed:', error.message);
    return;
  }
  const lines = data.locations
    .map((l) =>
      JSON.stringify({
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        alt: l.coords.altitude,
        acc: l.coords.accuracy,
        t: l.timestamp,
      }),
    )
    .join('\n');
  try {
    if (!TRACK_FILE.exists) TRACK_FILE.create();
    TRACK_FILE.write(lines + '\n', { append: true });
  } catch (err) {
    console.warn('[tracking] could not save points:', err);
  }
  await checkRoute();
});

const STATE_FILE = new File(Paths.document, 'trailkit.json');
const ALERT_CHANNEL = 'off-route';
let offRoute = false;

/**
 * Runs with each GPS update, even with the phone in a pocket: if the trek has a planned route and
 * the hiker has left it, buzz once; when they're back on it, say so once.
 */
async function checkRoute(): Promise<void> {
  try {
    const trek = STATE_FILE.exists ? parseState(STATE_FILE.textSync())?.treks.find((t) => t.status === 'active') : undefined;
    if (!trek || trek.plannedRoute.length < 2) return;
    const nowOff = isOffRoute(readTrack(trek.startedAt ?? 0).slice(-2), trek.plannedRoute, offRoute);
    if (nowOff === offRoute) return;
    offRoute = nowOff;
    await Notifications.scheduleNotificationAsync({
      content: nowOff
        ? { title: 'You’ve left your planned route', body: 'Check the map in TrailKit to find your way back.', sound: true }
        : { title: 'Back on your route', body: 'You’re following your planned route again.' },
      trigger: { channelId: ALERT_CHANNEL },
    });
  } catch (err) {
    console.warn('[tracking] route check failed:', err);
  }
}

/** Whether the last check found the hiker off their planned route (for the in-app banner). */
export const isCurrentlyOffRoute = () => offRoute;

// Show alerts even when TrailKit is open; the banner on the trek screen says the same thing
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks once for alert permission; route alerts are skipped (not the trek) if it's refused. */
async function prepareAlerts(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: 'Off-route alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
    });
    await Notifications.requestPermissionsAsync();
  } catch (err) {
    console.warn('[tracking] alerts unavailable:', err);
  }
}

/**
 * Starts (or resumes) recording. A foreground service with a notification keeps it alive with the
 * screen off and only needs "while using the app" permission, not "allow all the time".
 * Returns a plain-language problem, or null when recording.
 */
export async function startTracking(fresh: boolean): Promise<string | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return 'Location is off, so your route won’t be drawn. You can still identify things.';
    if (fresh && TRACK_FILE.exists) TRACK_FILE.delete();
    if (fresh) offRoute = false;
    await prepareAlerts();
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) return null;
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 15,
      timeInterval: 5000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      // iOS: the blue status-bar pill is what lets "while using" keep recording with the screen off
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tracking your trek',
        notificationBody: 'TrailKit is saving your route offline.',
        killServiceOnDestroy: false,
      },
    });
    return null;
  } catch (err) {
    console.warn('[tracking] start failed:', err);
    return 'Couldn’t start recording your route. You can still identify things.';
  }
}

/**
 * Points recorded since `since` (the trek's start), with GPS jumps removed. Android hands the service
 * its cached last fix on start, which can be minutes old and from somewhere else.
 */
export function readTrack(since: number): TrackPoint[] {
  try {
    if (!TRACK_FILE.exists) return [];
    return cleanTrack(parseTrack(TRACK_FILE.textSync()).filter((p) => p.t >= since));
  } catch (err) {
    console.warn('[tracking] could not read track:', err);
    return [];
  }
}

/** Stops recording and hands back the trek's track; the file is cleared for the next trek. */
export async function stopTracking(since: number): Promise<TrackPoint[]> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) {
      await Location.stopLocationUpdatesAsync(TRACK_TASK);
    }
  } catch (err) {
    console.warn('[tracking] stop failed:', err);
  }
  const points = readTrack(since);
  try {
    if (TRACK_FILE.exists) TRACK_FILE.delete();
  } catch (err) {
    console.warn('[tracking] could not clear track:', err);
  }
  return points;
}

/** Where a sighting was taken: the latest recorded point, else the phone's last fix. */
export async function currentFix(since: number): Promise<{ lat: number; lng: number } | null> {
  const last = readTrack(since).at(-1);
  if (last) return { lat: last.lat, lng: last.lng };
  try {
    const pos = await Location.getLastKnownPositionAsync();
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** Where you are now, for "nearest" in Community. Asks for location once; null if refused or unknown. */
export async function whereAmI(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const pos =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    console.warn('[tracking] no location for Community:', err);
    return null;
  }
}
