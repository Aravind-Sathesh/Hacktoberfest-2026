import React from 'react';
import { type WidgetTaskHandlerProps, requestWidgetUpdate } from 'react-native-android-widget';
import { TodayWidget } from './TodayWidget';
import { type WidgetData, loadWidgetData, saveWidgetData } from './widgetData';

/**
 * Every widget event (added, hourly update, resize, the refresh icon) just redraws from saved data, so the
 * day rolls over on its own and nothing here touches the network.
 */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<TodayWidget data={await loadWidgetData()} now={new Date()} width={widgetInfo.width} height={widgetInfo.height} />);
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
