import { defaultStartAndEnd } from './eventDefaults';

// Local-time constructor only - see the note in dateUtils.test.ts.
const NOW = new Date(2023, 9, 15, 14, 37, 12, 500); // Oct 15 2023, 2:37:12.500 PM
const DAY = new Date(2023, 10, 3); // Nov 3 2023, local midnight

describe('defaultStartAndEnd', () => {
  test('explicit hour 0 starts at midnight, not the next round hour', () => {
    const { startsAt, endsAt } = defaultStartAndEnd(DAY, 0, NOW);
    expect(startsAt).toEqual(new Date(2023, 10, 3, 0, 0, 0, 0));
    expect(endsAt).toEqual(new Date(2023, 10, 3, 1, 0, 0, 0));
  });

  test('explicit hour is used on the given day', () => {
    const { startsAt, endsAt } = defaultStartAndEnd(DAY, 9, NOW);
    expect(startsAt).toEqual(new Date(2023, 10, 3, 9, 0, 0, 0));
    expect(endsAt).toEqual(new Date(2023, 10, 3, 10, 0, 0, 0));
  });

  test('day without an hour uses the next round hour from now', () => {
    const { startsAt } = defaultStartAndEnd(DAY, undefined, NOW);
    expect(startsAt).toEqual(new Date(2023, 10, 3, 15, 0, 0, 0));
  });

  test("ignores the day's own time-of-day", () => {
    const dayWithTime = new Date(2023, 10, 3, 10, 22, 45);
    const { startsAt } = defaultStartAndEnd(dayWithTime, undefined, NOW);
    expect(startsAt).toEqual(new Date(2023, 10, 3, 15, 0, 0, 0));
  });

  test('neither day nor hour starts at the next round hour from now', () => {
    const { startsAt, endsAt } = defaultStartAndEnd(undefined, undefined, NOW);
    expect(startsAt).toEqual(new Date(2023, 9, 15, 15, 0, 0, 0));
    expect(endsAt).toEqual(new Date(2023, 9, 15, 16, 0, 0, 0));
  });
});
