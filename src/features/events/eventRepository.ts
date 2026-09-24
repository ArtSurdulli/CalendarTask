/**
 * Local AsyncStorage-backed implementation of EventRepository.
 *
 * This is the documented swap point for a real backend, and the ONLY
 * file allowed to import AsyncStorage for events. Screens and the Redux
 * slice go through the `EventRepository` interface instead.
 *
 * `startsAt`/`endsAt` are stored as local, non-'Z' ISO strings (see
 * src/types). This file does no Date-to-string conversion at all -
 * `create` and `update` both take already-serialized strings. Callers
 * (the slice, eventually a form) are responsible for producing those
 * strings via `toLocalISOString` (dateUtils), never `Date#toISOString`
 * (which would convert to UTC and could shift the stored string onto the
 * wrong calendar day).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent, EventCategory } from '../../types';

const EVENTS_KEY = '@events/events';

export type NewEventInput = Omit<CalendarEvent, 'id'>;

/** What's actually on disk may predate `category` - it wasn't always a
 * stored field, so a record read back from an old save can be missing it. */
type StoredCalendarEvent = Omit<CalendarEvent, 'category'> & {
  category?: EventCategory;
};

/** Backfills events written before `category` existed to `'other'`, so
 * old data doesn't break rather than surfacing as `undefined`. */
function normalizeEvent(event: StoredCalendarEvent): CalendarEvent {
  return { ...event, category: event.category ?? 'other' };
}

export interface EventRepository {
  listForUser(userId: string): Promise<CalendarEvent[]>;
  create(input: NewEventInput): Promise<CalendarEvent>;
  update(event: CalendarEvent): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}

function generateId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readEvents(): Promise<CalendarEvent[]> {
  const raw = await AsyncStorage.getItem(EVENTS_KEY);
  const stored: StoredCalendarEvent[] = raw ? JSON.parse(raw) : [];
  return stored.map(normalizeEvent);
}

async function writeEvents(events: CalendarEvent[]): Promise<void> {
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

class LocalEventRepository implements EventRepository {
  async listForUser(userId: string): Promise<CalendarEvent[]> {
    const events = await readEvents();
    return events.filter((event) => event.userId === userId);
  }

  async create(input: NewEventInput): Promise<CalendarEvent> {
    const events = await readEvents();
    const newEvent: CalendarEvent = { ...input, id: generateId() };

    await writeEvents([...events, newEvent]);
    return newEvent;
  }

  async update(event: CalendarEvent): Promise<CalendarEvent> {
    const events = await readEvents();
    const index = events.findIndex(
      (existing) => existing.id === event.id && existing.userId === event.userId,
    );

    if (index === -1) {
      throw new Error('Event not found.');
    }

    const updatedEvents = [...events];
    updatedEvents[index] = event;
    await writeEvents(updatedEvents);
    return event;
  }

  async remove(id: string): Promise<void> {
    const events = await readEvents();
    await writeEvents(events.filter((event) => event.id !== id));
  }
}

export const eventRepository: EventRepository = new LocalEventRepository();
