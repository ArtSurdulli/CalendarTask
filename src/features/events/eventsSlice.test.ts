import { configureStore } from '@reduxjs/toolkit';
import eventsReducer, {
  createEvent,
  deleteEvent,
  loadEvents,
  selectEventCategoriesByDayForMonth,
  selectEventCountsByDayForMonth,
  selectEventStats,
  selectEventsForDay,
  updateEvent,
} from './eventsSlice';
import { eventRepository } from './eventRepository';
import authReducer, { signOut } from '../auth/authSlice';
import type { CalendarEvent } from '../../types';

jest.mock('./eventRepository', () => ({
  eventRepository: {
    listForUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockedRepository = eventRepository as jest.Mocked<typeof eventRepository>;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    userId: 'user-1',
    title: 'Standup',
    category: 'other',
    startsAt: '2023-10-15T09:00:00',
    // Overriding only `startsAt` must not leave the default end behind, or
    // the event would silently span every day in between.
    endsAt: overrides.startsAt ?? '2023-10-15T09:30:00',
    ...overrides,
  };
}

// Mirrors the real store's shape (auth + events) so selectors typed
// against RootState - like selectEventsForDay - can be exercised as-is.
function createTestStore() {
  return configureStore({ reducer: { auth: authReducer, events: eventsReducer } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('eventsSlice', () => {
  test('loadEvents populates items', async () => {
    const events = [makeEvent(), makeEvent({ id: 'event-2' })];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const state = store.getState().events;
    expect(state.items).toEqual(events);
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(mockedRepository.listForUser).toHaveBeenCalledWith('user-1');
  });

  test('createEvent appends the new event', async () => {
    const existing = makeEvent({ id: 'event-1' });
    const created = makeEvent({ id: 'event-2', title: 'Lunch' });
    mockedRepository.listForUser.mockResolvedValue([existing]);
    mockedRepository.create.mockResolvedValue(created);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    await store.dispatch(
      createEvent({
        userId: 'user-1',
        title: 'Lunch',
        category: 'other',
        startsAt: '2023-10-15T12:00:00',
        endsAt: '2023-10-15T13:00:00',
      }),
    );

    expect(store.getState().events.items).toEqual([existing, created]);
  });

  test('updateEvent replaces the matching event in place', async () => {
    const original = makeEvent({ id: 'event-1', title: 'Standup' });
    const other = makeEvent({ id: 'event-2', title: 'Lunch' });
    const updated = makeEvent({ id: 'event-1', title: 'Standup (moved)' });
    mockedRepository.listForUser.mockResolvedValue([original, other]);
    mockedRepository.update.mockResolvedValue(updated);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    await store.dispatch(
      updateEvent({
        id: 'event-1',
        userId: 'user-1',
        title: 'Standup (moved)',
        category: 'other',
        startsAt: '2023-10-15T10:00:00',
        endsAt: '2023-10-15T10:30:00',
      }),
    );

    // Replaced in place, not appended - order and the untouched sibling
    // event are both preserved.
    expect(store.getState().events.items).toEqual([updated, other]);
  });

  test('deleteEvent removes the matching event', async () => {
    const first = makeEvent({ id: 'event-1' });
    const second = makeEvent({ id: 'event-2' });
    mockedRepository.listForUser.mockResolvedValue([first, second]);
    mockedRepository.remove.mockResolvedValue(undefined);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    await store.dispatch(deleteEvent('event-1'));

    expect(store.getState().events.items).toEqual([second]);
    expect(mockedRepository.remove).toHaveBeenCalledWith('event-1');
  });

  test('selectEventsForDay reflects a newly created event without a reload', async () => {
    const created = makeEvent({
      id: 'event-1',
      startsAt: '2023-10-15T12:00:00',
      endsAt: '2023-10-15T13:00:00',
    });
    mockedRepository.create.mockResolvedValue(created);

    const store = createTestStore();
    await store.dispatch(
      createEvent({
        userId: 'user-1',
        title: 'Standup',
        category: 'other',
        startsAt: '2023-10-15T12:00:00',
        endsAt: '2023-10-15T13:00:00',
      }),
    );

    expect(selectEventsForDay(store.getState(), new Date(2023, 9, 15))).toEqual([created]);
  });

  test('a rejected thunk sets error and clears the loading status', async () => {
    mockedRepository.listForUser.mockRejectedValue(new Error('Network unavailable'));

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const state = store.getState().events;
    expect(state.status).toBe('idle');
    expect(state.error).toBe('Network unavailable');
  });
});

describe('selectEventCountsByDayForMonth', () => {
  test('counts events per day, keyed by yyyy-MM-dd', async () => {
    const events = [
      makeEvent({ id: 'a', startsAt: '2023-10-15T09:00:00' }),
      makeEvent({ id: 'b', startsAt: '2023-10-15T14:00:00' }),
      makeEvent({ id: 'c', startsAt: '2023-10-03T09:00:00' }),
    ];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const counts = selectEventCountsByDayForMonth(store.getState(), new Date(2023, 9, 1));

    expect(counts.get('2023-10-15')).toBe(2);
    expect(counts.get('2023-10-03')).toBe(1);
  });

  test('excludes events outside the given month', async () => {
    const events = [
      makeEvent({ id: 'in-month', startsAt: '2023-10-15T09:00:00' }),
      makeEvent({ id: 'other-month', startsAt: '2023-11-01T09:00:00' }),
    ];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const counts = selectEventCountsByDayForMonth(store.getState(), new Date(2023, 9, 1));

    expect(counts.get('2023-10-15')).toBe(1);
    expect(counts.has('2023-11-01')).toBe(false);
    expect(counts.size).toBe(1);
  });
});

describe('selectEventCategoriesByDayForMonth', () => {
  test('collects distinct categories per day, in EVENT_CATEGORIES order', async () => {
    const events = [
      makeEvent({ id: 'a', category: 'social', startsAt: '2023-10-15T09:00:00' }),
      makeEvent({ id: 'b', category: 'work', startsAt: '2023-10-15T14:00:00' }),
      makeEvent({ id: 'c', category: 'work', startsAt: '2023-10-03T09:00:00' }),
    ];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const categories = selectEventCategoriesByDayForMonth(store.getState(), new Date(2023, 9, 1));

    // Two categories present on the 15th, deduped and ordered 'work'
    // before 'social' per EVENT_CATEGORIES, not insertion order.
    expect(categories.get('2023-10-15')).toEqual(['work', 'social']);
    expect(categories.get('2023-10-03')).toEqual(['work']);
  });

  test('excludes events outside the given month', async () => {
    const events = [
      makeEvent({ id: 'in-month', category: 'health', startsAt: '2023-10-15T09:00:00' }),
      makeEvent({ id: 'other-month', category: 'personal', startsAt: '2023-11-01T09:00:00' }),
    ];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    const categories = selectEventCategoriesByDayForMonth(store.getState(), new Date(2023, 9, 1));

    expect(categories.get('2023-10-15')).toEqual(['health']);
    expect(categories.has('2023-11-01')).toBe(false);
  });
});

describe('selectEventStats', () => {
  test('counts all events, events in the month, and finds the earliest start', async () => {
    const events = [
      makeEvent({ id: 'a', startsAt: '2023-10-15T09:00:00' }),
      makeEvent({ id: 'b', startsAt: '2023-10-03T14:00:00' }),
      makeEvent({ id: 'c', startsAt: '2023-11-01T09:00:00' }),
      makeEvent({ id: 'd', startsAt: '2022-12-31T23:30:00' }),
    ];
    mockedRepository.listForUser.mockResolvedValue(events);

    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    expect(selectEventStats(store.getState(), new Date(2023, 9, 20))).toEqual({
      total: 4,
      inMonth: 2,
      earliestStartsAt: '2022-12-31T23:30:00',
    });
  });

  test('with no events, counts are zero and there is no earliest start', () => {
    const store = createTestStore();

    expect(selectEventStats(store.getState(), new Date(2023, 9, 20))).toEqual({
      total: 0,
      inMonth: 0,
      earliestStartsAt: undefined,
    });
  });

  test('returns the same object for unchanged items and month', async () => {
    mockedRepository.listForUser.mockResolvedValue([makeEvent()]);
    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));
    const month = new Date(2023, 9, 20);

    expect(selectEventStats(store.getState(), month)).toBe(
      selectEventStats(store.getState(), month),
    );
  });
});

describe('multi-day events in the month selectors', () => {
  async function storeWith(events: CalendarEvent[]) {
    mockedRepository.listForUser.mockResolvedValue(events);
    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));
    return store;
  }

  test('an event spanning midnight is counted, with its category, on both days', async () => {
    const store = await storeWith([
      makeEvent({
        id: 'late-show',
        category: 'social',
        startsAt: '2023-10-25T20:00:00',
        endsAt: '2023-10-26T01:00:00',
      }),
    ]);
    const october = new Date(2023, 9, 1);

    const counts = selectEventCountsByDayForMonth(store.getState(), october);
    expect(counts.get('2023-10-25')).toBe(1);
    expect(counts.get('2023-10-26')).toBe(1);
    expect(counts.size).toBe(2);

    const categories = selectEventCategoriesByDayForMonth(store.getState(), october);
    expect(categories.get('2023-10-25')).toEqual(['social']);
    expect(categories.get('2023-10-26')).toEqual(['social']);
  });

  test('an event crossing a month boundary is counted in each month on its own days', async () => {
    const store = await storeWith([
      makeEvent({ id: 'nye', startsAt: '2023-10-31T22:00:00', endsAt: '2023-11-01T02:00:00' }),
    ]);

    const october = selectEventCountsByDayForMonth(store.getState(), new Date(2023, 9, 1));
    const november = selectEventCountsByDayForMonth(store.getState(), new Date(2023, 10, 1));

    expect([...october.keys()]).toEqual(['2023-10-31']);
    expect([...november.keys()]).toEqual(['2023-11-01']);
  });

  test('an event ending exactly at midnight is not counted on the next day', async () => {
    const store = await storeWith([
      makeEvent({ id: 'evening', startsAt: '2023-10-25T20:00:00', endsAt: '2023-10-26T00:00:00' }),
    ]);

    const counts = selectEventCountsByDayForMonth(store.getState(), new Date(2023, 9, 1));

    expect([...counts.keys()]).toEqual(['2023-10-25']);
  });

  test('selectEventsForDay returns a continuing event on its second day', async () => {
    const lateShow = makeEvent({
      id: 'late-show',
      startsAt: '2023-10-25T20:00:00',
      endsAt: '2023-10-26T01:00:00',
    });
    const store = await storeWith([lateShow]);

    expect(selectEventsForDay(store.getState(), new Date(2023, 9, 26))).toEqual([lateShow]);
  });
});

describe('switching users', () => {
  test('signing out clears the signed-out user\'s events, status and error', async () => {
    mockedRepository.listForUser.mockResolvedValue([makeEvent()]);
    const store = createTestStore();
    await store.dispatch(loadEvents('user-1'));

    store.dispatch(signOut.fulfilled(undefined, 'request-id'));

    expect(store.getState().events).toEqual({
      items: [],
      status: 'idle',
      error: null,
      userId: null,
    });
  });

  test("a late load for a previous user doesn't overwrite the current user's events", async () => {
    let resolveFirst!: (events: CalendarEvent[]) => void;
    const firstUsersLoad = new Promise<CalendarEvent[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondUsersEvent = makeEvent({ id: 'b-1', userId: 'user-2' });
    mockedRepository.listForUser
      .mockReturnValueOnce(firstUsersLoad)
      .mockResolvedValueOnce([secondUsersEvent]);

    const store = createTestStore();
    const slowLoad = store.dispatch(loadEvents('user-1'));
    store.dispatch(signOut.fulfilled(undefined, 'request-id'));
    await store.dispatch(loadEvents('user-2'));

    resolveFirst([makeEvent({ id: 'a-1', userId: 'user-1' })]);
    await slowLoad;

    expect(store.getState().events.items).toEqual([secondUsersEvent]);
  });

  test('a late load that finishes after sign-out leaves the list empty', async () => {
    let resolveLoad!: (events: CalendarEvent[]) => void;
    mockedRepository.listForUser.mockReturnValueOnce(
      new Promise<CalendarEvent[]>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const store = createTestStore();
    const slowLoad = store.dispatch(loadEvents('user-1'));
    store.dispatch(signOut.fulfilled(undefined, 'request-id'));

    resolveLoad([makeEvent()]);
    await slowLoad;

    expect(store.getState().events.items).toEqual([]);
  });
});
