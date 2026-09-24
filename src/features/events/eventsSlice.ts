import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { isSameMonth, parseISO } from 'date-fns';
import { eventRepository, type NewEventInput } from './eventRepository';
import { getEventsForDay, toDayKey } from '../calendar/dateUtils';
import { EVENT_CATEGORIES, type CalendarEvent, type EventCategory } from '../../types';
import type { RootState } from '../../app/store';

export type EventsStatus = 'idle' | 'loading';

export interface EventsState {
  items: CalendarEvent[];
  status: EventsStatus;
  error: string | null;
}

const initialState: EventsState = {
  items: [],
  status: 'idle',
  error: null,
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export const loadEvents = createAsyncThunk<CalendarEvent[], string, { rejectValue: string }>(
  'events/loadEvents',
  async (userId, { rejectWithValue }) => {
    try {
      return await eventRepository.listForUser(userId);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export const createEvent = createAsyncThunk<
  CalendarEvent,
  NewEventInput,
  { rejectValue: string }
>('events/createEvent', async (input, { rejectWithValue }) => {
  try {
    return await eventRepository.create(input);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const updateEvent = createAsyncThunk<
  CalendarEvent,
  CalendarEvent,
  { rejectValue: string }
>('events/updateEvent', async (event, { rejectWithValue }) => {
  try {
    return await eventRepository.update(event);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const deleteEvent = createAsyncThunk<string, string, { rejectValue: string }>(
  'events/deleteEvent',
  async (id, { rejectWithValue }) => {
    try {
      await eventRepository.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadEvents.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadEvents.fulfilled, (state, action: PayloadAction<CalendarEvent[]>) => {
        state.items = action.payload;
        state.status = 'idle';
      })
      .addCase(loadEvents.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Failed to load events.';
      })

      .addCase(createEvent.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action: PayloadAction<CalendarEvent>) => {
        state.items.push(action.payload);
        state.status = 'idle';
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Failed to create event.';
      })

      .addCase(updateEvent.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(updateEvent.fulfilled, (state, action: PayloadAction<CalendarEvent>) => {
        const index = state.items.findIndex((event) => event.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.status = 'idle';
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Failed to update event.';
      })

      .addCase(deleteEvent.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(deleteEvent.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter((event) => event.id !== action.payload);
        state.status = 'idle';
      })
      .addCase(deleteEvent.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Failed to delete event.';
      });
  },
});

export default eventsSlice.reducer;

export const selectEventItems = (state: RootState): CalendarEvent[] => state.events.items;

/** Events falling on `day`, derived from dateUtils's own day-matching logic. */
export const selectEventsForDay = createSelector(
  [selectEventItems, (_state: RootState, day: Date) => day],
  (items, day) => getEventsForDay(day, items),
);

/** Events whose `startsAt` falls within `month` (the calendar month currently on screen). */
function eventsInMonth(items: CalendarEvent[], month: Date): CalendarEvent[] {
  return items.filter((event) => isSameMonth(parseISO(event.startsAt), month));
}

/**
 * Event count per day (keyed via `toDayKey`) for events falling within
 * `month`. Used to render presence dots/labels in the month grid without
 * handing the grid raw event objects.
 */
export const selectEventCountsByDayForMonth = createSelector(
  [selectEventItems, (_state: RootState, month: Date) => month],
  (items, month) => {
    const counts = new Map<string, number>();

    for (const event of eventsInMonth(items, month)) {
      const key = toDayKey(parseISO(event.startsAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  },
);

/**
 * Distinct event categories per day (keyed via `toDayKey`) for `month`,
 * ordered per `EVENT_CATEGORIES` so the dots the grid renders are in a
 * stable, consistent order rather than insertion order.
 */
export const selectEventCategoriesByDayForMonth = createSelector(
  [selectEventItems, (_state: RootState, month: Date) => month],
  (items, month) => {
    const categoriesByDay = new Map<string, Set<EventCategory>>();

    for (const event of eventsInMonth(items, month)) {
      const key = toDayKey(parseISO(event.startsAt));
      const categoriesForDay = categoriesByDay.get(key) ?? new Set<EventCategory>();
      categoriesForDay.add(event.category);
      categoriesByDay.set(key, categoriesForDay);
    }

    const result = new Map<string, EventCategory[]>();
    for (const [key, categoriesForDay] of categoriesByDay) {
      result.set(
        key,
        EVENT_CATEGORIES.filter((category) => categoriesForDay.has(category)),
      );
    }
    return result;
  },
);
