import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { DayScheduleView } from './DayScheduleView';

function renderSchedule(onCreate: (hour: number) => void) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DayScheduleView
        day={new Date(2023, 10, 3)}
        events={[]}
        onSelectEvent={jest.fn()}
        onCreate={onCreate}
      />,
    );
  });
  return renderer;
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
