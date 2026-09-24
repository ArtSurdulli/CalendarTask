import { parseISO } from 'date-fns';
import type { CalendarEvent } from '../../types';
import {
  CALENDAR_COLUMNS,
  getEventsForDay,
  getMonthGrid,
  getNextDay,
  getNextMonth,
  getPreviousDay,
  getPreviousMonth,
  isSameCalendarDay,
  toDayKey,
  toLocalISOString,
} from './dateUtils';

/**
 * Always build fixture dates with the local `Date(y, monthIndex, day, ...)`
 * constructor, never by parsing an ISO/UTC string - that's the whole point
 * being tested, and mixing the two would silently reintroduce the bug this
 * module exists to avoid.
 */
function localDate(year: number, month: number, day: number): Date {
  // `month` is 1-indexed here to match how the cases below are described.
  return new Date(year, month - 1, day);
}

describe('getMonthGrid', () => {
  test('cells.length is always rows * 7', () => {
    const months = [
      localDate(2023, 10, 1),
      localDate(2023, 5, 1),
      localDate(2024, 2, 1),
      localDate(2023, 2, 1),
      localDate(2027, 2, 1),
      localDate(2025, 12, 1),
    ];

    for (const month of months) {
      const { cells, rows } = getMonthGrid(month);
      expect(cells.length).toBe(rows * CALENDAR_COLUMNS);
    }
  });

  test('month starting on a Sunday (October 2023) is a six-row month', () => {
    const { cells, rows } = getMonthGrid(localDate(2023, 10, 1));

    expect(rows).toBe(6);
    expect(cells).toHaveLength(42);

    // Oct 1 2023 is a Sunday, so the Monday-start grid begins on Sep 25.
    expect(cells[0].date).toEqual(localDate(2023, 9, 25));
    expect(cells[0].isCurrentMonth).toBe(false);

    expect(cells[41].date).toEqual(localDate(2023, 11, 5));
    expect(cells[41].isCurrentMonth).toBe(false);

    // Oct 1 itself is the 7th cell (index 6) and is in-month.
    expect(cells[6].date).toEqual(localDate(2023, 10, 1));
    expect(cells[6].isCurrentMonth).toBe(true);
  });

  test('month starting on a Monday (May 2023) needs no leading padding', () => {
    const { cells, rows } = getMonthGrid(localDate(2023, 5, 1));

    expect(rows).toBe(5);
    expect(cells).toHaveLength(35);

    expect(cells[0].date).toEqual(localDate(2023, 5, 1));
    expect(cells[0].isCurrentMonth).toBe(true);

    expect(cells[34].date).toEqual(localDate(2023, 6, 4));
    expect(cells[34].isCurrentMonth).toBe(false);
  });

  test('February in a leap year (2024) includes Feb 29', () => {
    const { cells, rows } = getMonthGrid(localDate(2024, 2, 1));

    expect(rows).toBe(5);
    expect(cells[0].date).toEqual(localDate(2024, 1, 29));
    expect(cells[cells.length - 1].date).toEqual(localDate(2024, 3, 3));

    const inMonthDates = cells.filter((c) => c.isCurrentMonth).map((c) => c.date);
    expect(inMonthDates).toHaveLength(29);
    expect(inMonthDates).toContainEqual(localDate(2024, 2, 29));
  });

  test('February in a non-leap year (2023) is a five-row month stopping at Feb 28', () => {
    const { cells, rows } = getMonthGrid(localDate(2023, 2, 1));

    expect(rows).toBe(5);
    expect(cells[0].date).toEqual(localDate(2023, 1, 30));
    expect(cells[cells.length - 1].date).toEqual(localDate(2023, 3, 5));

    const inMonthDates = cells.filter((c) => c.isCurrentMonth).map((c) => c.date);
    expect(inMonthDates).toHaveLength(28);
    expect(inMonthDates).not.toContainEqual(localDate(2023, 2, 29));
  });

  test('February 2027 is a four-row month with no out-of-month cells', () => {
    const { cells, rows } = getMonthGrid(localDate(2027, 2, 1));

    expect(rows).toBe(4);
    expect(cells).toHaveLength(28);
    expect(cells[0].date).toEqual(localDate(2027, 2, 1));
    expect(cells[cells.length - 1].date).toEqual(localDate(2027, 2, 28));
    expect(cells.every((c) => c.isCurrentMonth)).toBe(true);
  });

  test('December rolls trailing cells into January of the next year', () => {
    const { cells, rows } = getMonthGrid(localDate(2025, 12, 1));

    expect(rows).toBe(5);
    expect(cells[0].date).toEqual(localDate(2025, 12, 1));
    expect(cells[0].isCurrentMonth).toBe(true);

    expect(cells[cells.length - 1].date).toEqual(localDate(2026, 1, 4));
    expect(cells[cells.length - 1].isCurrentMonth).toBe(false);

    const trailingIntoJanuary = cells.some(
      (c) => c.date.getFullYear() === 2026 && c.date.getMonth() === 0,
    );
    expect(trailingIntoJanuary).toBe(true);
  });

  test('marks isToday for the frozen "today" and nothing else', () => {
    const frozenToday = localDate(2023, 10, 15);
    const { cells } = getMonthGrid(localDate(2023, 10, 1), frozenToday);

    const todayCells = cells.filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toEqual(localDate(2023, 10, 15));
  });

  test('rows matches Math.ceil((offset + daysInMonth) / 7) for every month of a year', () => {
    const YEAR = 2023;

    for (let month = 1; month <= 12; month += 1) {
      const dayOfWeek = new Date(YEAR, month - 1, 1).getDay(); // 0=Sun..6=Sat
      const mondayFirstOffset = (dayOfWeek + 6) % 7; // 0=Mon..6=Sun
      const daysInMonth = new Date(YEAR, month, 0).getDate();
      const expectedRows = Math.ceil((mondayFirstOffset + daysInMonth) / 7);

      const { rows, cells } = getMonthGrid(localDate(YEAR, month, 1));

      expect(rows).toBe(expectedRows);
      expect(cells).toHaveLength(expectedRows * CALENDAR_COLUMNS);
    }
  });
});

describe('getNextMonth / getPreviousMonth', () => {
  test('advances within a year', () => {
    const next = getNextMonth(localDate(2023, 5, 15));
    expect(next.getFullYear()).toBe(2023);
    expect(next.getMonth()).toBe(5); // June (0-indexed)
  });

  test('rolls December forward into January of the next year', () => {
    const next = getNextMonth(localDate(2023, 12, 10));
    expect(next.getFullYear()).toBe(2024);
    expect(next.getMonth()).toBe(0); // January
  });

  test('rolls January backward into December of the previous year', () => {
    const prev = getPreviousMonth(localDate(2024, 1, 10));
    expect(prev.getFullYear()).toBe(2023);
    expect(prev.getMonth()).toBe(11); // December
  });
});

describe('getNextDay / getPreviousDay', () => {
  test('advances within a month', () => {
    const next = getNextDay(localDate(2023, 10, 15));
    expect(next).toEqual(localDate(2023, 10, 16));
  });

  test('rolls forward across a month boundary', () => {
    const next = getNextDay(localDate(2023, 10, 31));
    expect(next).toEqual(localDate(2023, 11, 1));
  });

  test('rolls forward across a year boundary', () => {
    const next = getNextDay(localDate(2023, 12, 31));
    expect(next).toEqual(localDate(2024, 1, 1));
  });

  test('rolls backward across a month boundary', () => {
    const prev = getPreviousDay(localDate(2023, 11, 1));
    expect(prev).toEqual(localDate(2023, 10, 31));
  });

  test('rolls backward across a year boundary', () => {
    const prev = getPreviousDay(localDate(2024, 1, 1));
    expect(prev).toEqual(localDate(2023, 12, 31));
  });
});

describe('isSameCalendarDay', () => {
  test('true for the same day at different times', () => {
    const morning = localDate(2023, 10, 15);
    morning.setHours(6, 0, 0, 0);
    const night = localDate(2023, 10, 15);
    night.setHours(23, 59, 0, 0);

    expect(isSameCalendarDay(morning, night)).toBe(true);
  });

  test('false across midnight', () => {
    const lateNight = localDate(2023, 10, 15);
    lateNight.setHours(23, 59, 0, 0);
    const justAfterMidnight = localDate(2023, 10, 16);
    justAfterMidnight.setHours(0, 1, 0, 0);

    expect(isSameCalendarDay(lateNight, justAfterMidnight)).toBe(false);
  });
});

describe('getEventsForDay', () => {
  function makeEvent(id: string, startsAt: string, endsAt: string = startsAt): CalendarEvent {
    return { id, userId: 'user-1', title: `Event ${id}`, category: 'other', startsAt, endsAt };
  }

  test('returns only events on the given local day', () => {
    const events: CalendarEvent[] = [
      makeEvent('early', '2023-10-15T00:05:00'),
      makeEvent('midday', '2023-10-15T12:00:00'),
      makeEvent('late', '2023-10-15T23:55:00'),
      makeEvent('day-before', '2023-10-14T23:55:00'),
      makeEvent('day-after', '2023-10-16T00:05:00'),
    ];

    const result = getEventsForDay(localDate(2023, 10, 15), events);

    expect(result.map((e) => e.id).sort()).toEqual(['early', 'late', 'midday']);
  });

  test('returns an empty array when nothing matches', () => {
    const events: CalendarEvent[] = [makeEvent('other-day', '2023-10-01T09:00:00')];
    expect(getEventsForDay(localDate(2023, 10, 15), events)).toEqual([]);
  });
});

describe('toLocalISOString', () => {
  test('round-trips through parseISO to the same calendar day', () => {
    const original = localDate(2023, 10, 15);
    original.setHours(9, 30, 0, 0);

    const roundTripped = parseISO(toLocalISOString(original));

    expect(isSameCalendarDay(roundTripped, original)).toBe(true);
    expect(roundTripped.getHours()).toBe(9);
    expect(roundTripped.getMinutes()).toBe(30);
  });

  test('round-trips a 23:55 timestamp without crossing midnight', () => {
    const original = localDate(2023, 10, 15);
    original.setHours(23, 55, 0, 0);

    const roundTripped = parseISO(toLocalISOString(original));

    expect(isSameCalendarDay(roundTripped, original)).toBe(true);
    expect(roundTripped.getHours()).toBe(23);
    expect(roundTripped.getMinutes()).toBe(55);
  });
});

describe('toDayKey', () => {
  test('builds a yyyy-MM-dd key', () => {
    expect(toDayKey(localDate(2026, 3, 3))).toBe('2026-03-03');
  });

  test('two different times on the same local day produce the same key', () => {
    const morning = localDate(2023, 10, 15);
    morning.setHours(0, 5, 0, 0);
    const lateNight = localDate(2023, 10, 15);
    lateNight.setHours(23, 55, 0, 0);

    expect(toDayKey(morning)).toBe(toDayKey(lateNight));
  });

  test('does not shift onto the next day near midnight', () => {
    const almostMidnight = localDate(2023, 10, 15);
    almostMidnight.setHours(23, 59, 0, 0);

    expect(toDayKey(almostMidnight)).toBe('2023-10-15');
  });
});
