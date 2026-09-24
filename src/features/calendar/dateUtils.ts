import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import type { CalendarEvent } from '../../types';

/**
 * All date handling in this module is local-time only.
 *
 * We build the grid out of plain `Date` objects (constructed or produced by
 * date-fns), never by parsing/formatting through UTC or `Date#toISOString`.
 * date-fns's day-level functions (`isSameDay`, `isSameMonth`, `startOfWeek`,
 * `eachDayOfInterval`, ...) all compare/operate on a Date's local
 * year/month/day fields, so a device in any timezone buckets a given
 * instant into the same calendar cell a user would expect.
 *
 * `CalendarEvent.startsAt`/`endsAt` are expected to be ISO strings
 * *without* a 'Z'/offset suffix (see src/types). `parseISO` then
 * interprets them as local wall-clock time instead of UTC, so an event
 * stored as "2026-09-23T09:00:00" always lands on Sep 23 in local time,
 * regardless of the device's timezone offset. `toLocalISOString` below is
 * the sanctioned way to produce that string from a `Date` - never
 * `Date#toISOString`, which converts to UTC and can shift the string onto
 * the wrong calendar day near midnight.
 */

export const CALENDAR_COLUMNS = 7;
/** Upper bound on rows a month grid can need - for fixed-height layout. */
export const MAX_CALENDAR_ROWS = 6;

/** Monday, per date-fns's 0=Sunday..6=Saturday convention. */
const WEEK_STARTS_ON = 1;

export interface CalendarDayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface MonthGrid {
  cells: CalendarDayCell[];
  /** Number of weeks in this grid: 4, 5, or 6. `cells.length === rows * 7`. */
  rows: number;
}

/**
 * Returns the grid of days for the month containing `monthDate`, starting
 * on Monday. The grid spans from the Monday of the week containing the
 * 1st of the month through the Sunday of the week containing the last day
 * of the month - so it's exactly as tall as that month needs (4, 5, or 6
 * rows of 7), including the trailing days of the previous month and
 * leading days of the next month needed to fill those weeks. Chunk
 * `cells` into groups of `CALENDAR_COLUMNS` to lay out rows.
 *
 * `today` defaults to `new Date()` but can be passed explicitly so this
 * stays a pure function under test.
 */
export function getMonthGrid(monthDate: Date, today: Date = new Date()): MonthGrid {
  const firstOfMonth = startOfMonth(monthDate);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: WEEK_STARTS_ON });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const rows = days.length / CALENDAR_COLUMNS;

  const cells = days.map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, firstOfMonth),
    isToday: isSameDay(date, today),
  }));

  return { cells, rows };
}

/** Returns a date anchored in the month following `date`'s month. */
export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

/** Returns a date anchored in the month preceding `date`'s month. */
export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1);
}

/** Returns the day following `date`. */
export function getNextDay(date: Date): Date {
  return addDays(date, 1);
}

/** Returns the day preceding `date`. */
export function getPreviousDay(date: Date): Date {
  return subDays(date, 1);
}

/** Whether `a` and `b` fall on the same calendar day, in local time. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

/** Returns the events from `events` whose `startsAt` falls on `day`. */
export function getEventsForDay(
  day: Date,
  events: CalendarEvent[],
): CalendarEvent[] {
  return events.filter((event) => isSameDay(parseISO(event.startsAt), day));
}

/**
 * The single sanctioned way to turn a `Date` into the local, non-'Z' ISO
 * string that `CalendarEvent.startsAt`/`endsAt` store. Never use
 * `Date#toISOString` for this - it converts to UTC and can land on the
 * wrong calendar day.
 */
export function toLocalISOString(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * The single sanctioned way to build a day key (`yyyy-MM-dd`, local time)
 * for indexing something per calendar day, e.g. an event-count map keyed
 * by day. Keeps the key format in one place.
 */
export function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
