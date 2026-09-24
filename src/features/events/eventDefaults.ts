const HOUR_MS = 60 * 60 * 1000;

/** `now`, rounded up to the top of the next hour. */
function nextRoundHour(now: Date): Date {
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  rounded.setHours(rounded.getHours() + 1);
  return rounded;
}

/**
 * Defaults for a brand-new event, ending an hour after it starts.
 *
 * - `day`: the calendar day to place the event on. Only its date is used;
 *   any time-of-day it carries is ignored.
 * - `hour`: an explicit start hour (0-23), e.g. from tapping an hour row in
 *   the day schedule. When absent, the next round hour from `now` is used.
 *
 * With neither, the event starts at the next round hour from `now`.
 */
export function defaultStartAndEnd(
  day?: Date,
  hour?: number,
  now: Date = new Date(),
): { startsAt: Date; endsAt: Date } {
  let startsAt: Date;
  if (day) {
    const startHour = hour ?? nextRoundHour(now).getHours();
    startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0);
  } else if (hour != null) {
    startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  } else {
    startsAt = nextRoundHour(now);
  }

  return { startsAt, endsAt: new Date(startsAt.getTime() + HOUR_MS) };
}
