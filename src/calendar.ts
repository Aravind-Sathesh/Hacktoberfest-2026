import { EntityTypes, getCalendars, listEvents, requestCalendarPermissions } from 'expo-calendar';
import { Block, mergeBlocks } from './plan';

/**
 * Today's busy blocks. Only start and end leave this function: titles, notes, locations and
 * attendees are never read further, stored, or shown to Gemma (Rajeev's rule).
 */
export async function todaysBusyBlocks(day: Date): Promise<Block[]> {
  const { granted } = await requestCalendarPermissions();
  if (!granted) return [];

  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const calendars = await getCalendars(EntityTypes.EVENT);
  const events = await listEvents(calendars, start, end);
  const blocks = events
    .filter((e) => !e.allDay && e.startDate !== undefined && e.endDate !== undefined)
    .map((e) => ({ start: new Date(e.startDate!).getTime(), end: new Date(e.endDate!).getTime() }));
  return mergeBlocks(blocks);
}
