import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { DayScheduleView, type DayScheduleViewProps } from './DayScheduleView';
import type { CalendarEvent } from '../../types';

function renderSchedule(
  onCreate: (hour: number) => void,
  overrides: Partial<DayScheduleViewProps> = {},
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DayScheduleView
        day={new Date(2023, 10, 3)}
        events={[]}
        onSelectEvent={jest.fn()}
        onCreate={onCreate}
        onShowDayEvents={jest.fn()}
        {...overrides}
      />,
    );
  });
  return renderer;
}

/** `count` events on Nov 3 2023, all running 9:00-10:00 (fully concurrent). */
function concurrentEvents(count: number): CalendarEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index + 1}`,
    userId: 'user-1',
    title: `Event ${index + 1}`,
    category: 'work',
    startsAt: '2023-11-03T09:00:00',
    endsAt: '2023-11-03T10:00:00',
  }));
}

/** Event blocks (not hour rows), in render order, with their laid-out position. */
function eventBlocks(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        String(node.props.accessibilityLabel).startsWith('Event '),
    )
    .map((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return {
        label: node.props.accessibilityLabel as string,
        onPress: node.props.onPress as () => void,
        left: style.left,
        width: style.width,
        text: node.findAllByType(Text).map((text) => text.props.children),
      };
    });
}

function hourRows(renderer: ReactTestRenderer.ReactTestRenderer) {
  // Pressable is memo-wrapped, so match on props rather than component type;
  // the host View underneath carries the label too but not `onPress`.
  return renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      String(node.props.accessibilityLabel).startsWith('Add event at '),
  );
}

describe('DayScheduleView', () => {
  test('renders 24 hour rows, 12 AM through 11 PM', () => {
    const rows = hourRows(renderSchedule(jest.fn()));

    expect(rows).toHaveLength(24);
    expect(rows[0].props.accessibilityLabel).toBe('Add event at 12 AM');
    expect(rows[12].props.accessibilityLabel).toBe('Add event at 12 PM');
    expect(rows[23].props.accessibilityLabel).toBe('Add event at 11 PM');
  });

  test('each row creates an event at its own hour, including both ends', () => {
    const onCreate = jest.fn();
    const rows = hourRows(renderSchedule(onCreate));

    rows.forEach((row) => ReactTestRenderer.act(() => row.props.onPress()));

    expect(onCreate.mock.calls.map(([hour]) => hour)).toEqual(
      Array.from({ length: 24 }, (_, hour) => hour),
    );
  });
});

describe('DayScheduleView overlapping events', () => {
  test('below four concurrent events, each gets its own evenly split column', () => {
    const blocks = eventBlocks(renderSchedule(jest.fn(), { events: concurrentEvents(3) }));

    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.width)).toEqual([
      `${100 / 3}%`,
      `${100 / 3}%`,
      `${100 / 3}%`,
    ]);
    expect(blocks.some((block) => block.text.includes('+1'))).toBe(false);
  });

  test('exactly four concurrent events still get four separate columns', () => {
    const blocks = eventBlocks(renderSchedule(jest.fn(), { events: concurrentEvents(4) }));

    expect(blocks.map((block) => block.left)).toEqual(['0%', '25%', '50%', '75%']);
    expect(blocks.map((block) => block.label)).toEqual([
      'Event 1, 9:00 AM – 10:00 AM',
      'Event 2, 9:00 AM – 10:00 AM',
      'Event 3, 9:00 AM – 10:00 AM',
      'Event 4, 9:00 AM – 10:00 AM',
    ]);
  });

  test('past four, the rest collapse into the last column with a +N indicator', () => {
    const onSelectEvent = jest.fn();
    const onShowDayEvents = jest.fn();
    const blocks = eventBlocks(
      renderSchedule(jest.fn(), { events: concurrentEvents(6), onSelectEvent, onShowDayEvents }),
    );

    expect(blocks).toHaveLength(4);
    expect(blocks.map((block) => block.left)).toEqual(['0%', '25%', '50%', '75%']);
    expect(blocks.every((block) => block.width === '25%')).toBe(true);

    const collapsed = blocks[3];
    expect(collapsed.text).toEqual(['Event 4', '+2']);
    expect(collapsed.label).toBe('Event 4, 9:00 AM – 10:00 AM, and 2 more events');

    ReactTestRenderer.act(() => collapsed.onPress());
    expect(onShowDayEvents).toHaveBeenCalledTimes(1);
    expect(onSelectEvent).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => blocks[0].onPress());
    expect(onSelectEvent).toHaveBeenCalledWith('event-1');
  });

  test('an overflow-column event overlapping no other overflow event is drawn on its own', () => {
    // Events 1-3 start 8:00/8:15/8:30 and run to 12 (columns 0-2); 4 and 5
    // run 9-10 (columns 3-4), forcing the cap. "Late" (11-11:30) reuses
    // column 3 once event 4 ends, so it's in the overflow column - but
    // concurrent with neither 4 nor 5.
    const [first, second, third, fourth, fifth] = concurrentEvents(5);
    const events = [
      { ...first, startsAt: '2023-11-03T08:00:00', endsAt: '2023-11-03T12:00:00' },
      { ...second, startsAt: '2023-11-03T08:15:00', endsAt: '2023-11-03T12:00:00' },
      { ...third, startsAt: '2023-11-03T08:30:00', endsAt: '2023-11-03T12:00:00' },
      fourth,
      fifth,
      {
        ...fourth,
        id: 'event-late',
        title: 'Event late',
        startsAt: '2023-11-03T11:00:00',
        endsAt: '2023-11-03T11:30:00',
      },
    ];
    const blocks = eventBlocks(renderSchedule(jest.fn(), { events }));

    const late = blocks.find((block) => block.label.startsWith('Event late'));
    expect(late?.left).toBe('75%');
    expect(late?.text).toEqual(['Event late']);

    const collapsed = blocks.filter((block) => block.left === '75%' && block !== late);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].text).toEqual(['Event 4', '+1']);
  });
});
