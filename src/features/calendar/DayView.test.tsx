import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DayView } from './DayView';
import type { CalendarEvent } from '../../types';

const DAY = new Date(2023, 9, 15);

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'event',
    userId: 'user-1',
    title: 'Event',
    category: 'other',
    startsAt: '2023-10-15T09:00:00',
    endsAt: '2023-10-15T10:00:00',
    ...overrides,
  };
}

function renderDayView(events: CalendarEvent[]) {
  const onSelectEvent = jest.fn();
  const onCreate = jest.fn();
  render(<DayView day={DAY} events={events} onSelectEvent={onSelectEvent} onCreate={onCreate} />);
  return { onSelectEvent, onCreate };
}

describe('DayView', () => {
  test('lists events sorted by start time, whatever order they arrive in', () => {
    renderDayView([
      makeEvent({
        id: 'late',
        title: 'Dinner',
        startsAt: '2023-10-15T19:00:00',
        endsAt: '2023-10-15T21:00:00',
      }),
      makeEvent({
        id: 'early',
        title: 'Gym',
        startsAt: '2023-10-15T07:30:00',
        endsAt: '2023-10-15T08:30:00',
      }),
      makeEvent({
        id: 'mid',
        title: 'Standup',
        startsAt: '2023-10-15T09:15:00',
        endsAt: '2023-10-15T09:30:00',
      }),
    ]);

    expect(screen.getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual([
      'Gym, 7:30 AM – 8:30 AM',
      'Standup, 9:15 AM – 9:30 AM',
      'Dinner, 7:00 PM – 9:00 PM',
    ]);
  });

  test('shows the date and event count in the header', () => {
    renderDayView([makeEvent({ id: 'a' }), makeEvent({ id: 'b' })]);

    expect(screen.getByText('Sunday, October 15, 2023 · 2 events')).toBeOnTheScreen();
  });

  test("shows an event's notes when it has them", () => {
    renderDayView([makeEvent({ description: 'Bring laptop' })]);

    expect(screen.getByText('Bring laptop')).toBeOnTheScreen();
  });

  test('calls onSelectEvent with the pressed event id', () => {
    const { onSelectEvent } = renderDayView([
      makeEvent({ id: 'first', title: 'Gym', startsAt: '2023-10-15T07:00:00' }),
      makeEvent({ id: 'second', title: 'Standup', startsAt: '2023-10-15T09:00:00' }),
    ]);

    fireEvent.press(screen.getByText('Standup'));

    expect(onSelectEvent).toHaveBeenCalledTimes(1);
    expect(onSelectEvent).toHaveBeenCalledWith('second');
  });

  test('with no events, shows the empty state and its create action', () => {
    const { onCreate, onSelectEvent } = renderDayView([]);

    expect(screen.getByText('Sunday, October 15, 2023 · 0 events')).toBeOnTheScreen();
    expect(screen.getByText('No events on this day.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Add event' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelectEvent).not.toHaveBeenCalled();
  });

  test('with events, shows no empty state', () => {
    renderDayView([makeEvent({})]);

    expect(screen.getByText('Sunday, October 15, 2023 · 1 event')).toBeOnTheScreen();
    expect(screen.queryByText('No events on this day.')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeOnTheScreen();
  });
});

describe('DayView with an event continuing from an earlier day', () => {
  const lateShow = makeEvent({
    id: 'late-show',
    title: 'Late show',
    startsAt: '2023-10-14T20:00:00',
    endsAt: '2023-10-15T01:00:00',
  });

  test('marks it as continuing and shows its real, dated start time', () => {
    renderDayView([lateShow]);

    expect(screen.getByText('Continued from Saturday')).toBeOnTheScreen();
    expect(screen.getByText('Sat Oct 14, 8:00 PM – 1:00 AM')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Late show, Sat Oct 14, 8:00 PM – 1:00 AM, continued from Saturday'),
    ).toBeOnTheScreen();
  });

  test('lists it before events that start on the day itself', () => {
    renderDayView([makeEvent({ id: 'gym', title: 'Gym', startsAt: '2023-10-15T07:00:00' }), lateShow]);

    expect(screen.getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual([
      'Late show, Sat Oct 14, 8:00 PM – 1:00 AM, continued from Saturday',
      'Gym, 7:00 AM – 10:00 AM',
    ]);
  });

  test('does not mark events that start on the day itself', () => {
    renderDayView([makeEvent({ id: 'gym', title: 'Gym', startsAt: '2023-10-15T07:00:00' })]);

    expect(screen.queryByText(/^Continued from/)).not.toBeOnTheScreen();
  });
});
