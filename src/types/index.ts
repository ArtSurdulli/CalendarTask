export interface User {
  id: string;
  name: string;
  email: string;
}

/** Single source of truth for category values - drives both the zod
 * schema and the chip picker UI, so they can't drift apart. */
export const EVENT_CATEGORIES = ['work', 'personal', 'health', 'social', 'other'] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: EventCategory;
  /**
   * Local wall-clock date/time, ISO 8601 *without* a UTC offset or 'Z'
   * suffix, e.g. "2026-09-23T14:00:00". This is what lets dateUtils parse
   * it back with date-fns `parseISO` as local time, matching the calendar
   * cell it was created in, instead of shifting across a day boundary
   * when the device's timezone isn't UTC. Use `toLocalISOString` (in
   * dateUtils) to produce this string from a `Date` - never
   * `Date#toISOString`, which converts to UTC.
   */
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
}
