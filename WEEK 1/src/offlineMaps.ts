import { OfflineManager } from '@maplibre/maplibre-react-native';
import { routeBounds, type Route } from './track';

// Free, keyless vector tiles (openfreemap.org); the same URLs are used for display and download
export const MAP_STYLE = {
  dark: 'https://tiles.openfreemap.org/styles/fiord',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

// Enough to read trails and contours on foot; zoom 16+ multiplies the download for little gain
const MIN_ZOOM = 10;
const MAX_ZOOM = 15;
// Room either side of the trail for a wrong turn
const PAD_M = 1500;

const packName = (trekId: string, dark: boolean) => `${trekId}-${dark ? 'dark' : 'light'}`;

/** Whether this trek's map area is already on the phone (for the current theme). */
export async function hasOfflineArea(trekId: string, dark: boolean): Promise<boolean> {
  try {
    const packs = await OfflineManager.getPacks();
    return packs.some((p) => p.metadata.name === packName(trekId, dark));
  } catch {
    return false;
  }
}

/** Downloads the map around a route so it shows with no signal. Reports 0–100. */
export async function downloadOfflineArea(
  trekId: string,
  route: Route,
  dark: boolean,
  onProgress: (percent: number) => void,
): Promise<void> {
  const bounds = routeBounds(route, PAD_M);
  if (!bounds) throw new Error('This trek has no route to download a map for.');
  await new Promise<void>((resolve, reject) => {
    OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE[dark ? 'dark' : 'light'],
        bounds,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        metadata: { name: packName(trekId, dark) },
      },
      (_pack, status) => {
        onProgress(Math.round(status.percentage));
        if (status.state === 'complete') resolve();
      },
      (_pack, error) => reject(new Error(`Map download failed: ${error.message}`)),
    ).catch(reject);
  });
}
