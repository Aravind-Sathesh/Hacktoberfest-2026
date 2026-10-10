import React from 'react';
import { type WidgetTaskHandlerProps, requestWidgetUpdate } from 'react-native-android-widget';
import { userStatus } from './cf';
import { solvedBeforeDay, solvesOnDay } from './stats';
import { TodayWidget } from './TodayWidget';
import { type WidgetData, loadWidgetData, saveWidgetData } from './widgetData';

// One request covers a day of solving, and stays well inside Codeforces' rate limit.
const RECENT_SUBMISSIONS = 100;

/**
 * Every widget event (added, the hourly update, resize) redraws from saved data, so the day rolls over on its
 * own with no network. Tapping the tree is the one exception: it shows a spinner, recounts today's solves
 * from his recent Codeforces submissions, and redraws. If Codeforces can't be reached it redraws what it had.
 */
export async function widgetTaskHandler({ widgetAction, widgetInfo, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const draw = (data: WidgetData | null, loading = false) =>
    renderWidget(<TodayWidget data={data} now={new Date()} width={widgetInfo.width} height={widgetInfo.height} loading={loading} />);
  const data = await loadWidgetData();
  if (widgetAction !== 'WIDGET_CLICK' || clickAction !== 'REFRESH' || !data) return draw(data);

  draw(data, true);
  try {
    const now = new Date();
    const recent = await userStatus(data.handle, RECENT_SUBMISSIONS);
    // After midnight, yesterday's solves join the "already solved" list, so they don't count as today's.
    const before = new Set([...data.solvedBefore, ...solvedBeforeDay(recent, now)]);
    const today = now.toDateString();
    const fresh: WidgetData = {
      ...data,
      solvedBefore: [...before],
      solves: [...data.solves.filter(([day]) => day !== today), [today, solvesOnDay(recent, before, now)]],
    };
    await saveWidgetData(fresh);
    draw(fresh);
  } catch (e) {
    console.warn('widget refresh failed', e);
    draw(data);
  }
}

// Enough for the widest one-tile grid (30 weeks).
const WIDGET_DAYS = 30 * 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Saves what the widget needs and redraws any placed on the home screen. A failure never reaches the app. */
export async function updateTodayWidget(data: WidgetData) {
  const cutoff = Date.now() - WIDGET_DAYS * DAY_MS;
  const recent: WidgetData = { ...data, solves: data.solves.filter(([day]) => new Date(day).getTime() >= cutoff) };
  try {
    await saveWidgetData(recent);
    await requestWidgetUpdate({ widgetName: 'Today', renderWidget: ({ width, height }) => <TodayWidget data={recent} now={new Date()} width={width} height={height} />,
    });
  } catch {
    // No widget on the home screen, or none supported; the app works the same without it.
  }
}
