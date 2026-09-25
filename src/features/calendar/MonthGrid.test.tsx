import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { MonthGrid, type MonthGridProps } from './MonthGrid';
import type { EventCategory } from '../../types';

jest.mock('../../app/useReduceMotion', () => ({ useReduceMotion: () => false }));

/**
 * Jest has no layout engine, so this checks the structure that makes the
 * grid fit: whole-week rows of seven `flex: 1` cells with no computed
 * widths. Fixed per-cell widths in a wrapping row were what overflowed -
 * pixel rounding pushed the seventh cell onto the next line at some
 * screen widths (e.g. 390pt), where the fixed grid height clipped it.
 */
function renderAtWidth(width: number) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      // October 2023 spans six Monday-first weeks.
      <MonthGrid
        month={new Date(2023, 9, 1)}
        selectedDay={new Date(2023, 9, 15)}
        onSelectDay={jest.fn()}
      />,
    );
  });

  const viewport = renderer.root.find(
    (node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function',
  );
  ReactTestRenderer.act(() => {
    viewport.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 0 } } });
  });
  return renderer;
}

function dayCells(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.props.accessibilityRole === 'button' &&
      /\d{4}/.test(String(node.props.accessibilityLabel)),
  );
}

describe.each([326, 376])('MonthGrid at %ipt of content width', (width) => {
  test('lays days out as rows of seven flexing cells with no fixed widths', () => {
    const renderer = renderAtWidth(width);
    const cells = dayCells(renderer);

    expect(cells).toHaveLength(42);
    for (const cell of cells) {
      const style = StyleSheet.flatten(cell.props.style);
      expect(style.flex).toBe(1);
      expect(style.width).toBeUndefined();
      expect(style.minWidth).toBeUndefined();
    }

    // Week rows: host row Views that directly contain day cells.
    const rows = renderer.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style)?.flexDirection === 'row' &&
        node.findAll((child) => cells.includes(child)).length > 0,
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(StyleSheet.flatten(row.props.style).flexWrap).toBeUndefined();
      expect(row.findAll((child) => cells.includes(child))).toHaveLength(7);
    }
  });

  test('renders every Sunday, as the last cell of each row', () => {
    const cells = dayCells(renderAtWidth(width));
    const sundays = cells.filter((_, index) => index % 7 === 6);

    expect(sundays).toHaveLength(6);
    for (const sunday of sundays) {
      expect(sunday.props.accessibilityLabel).toMatch(/^Sunday, /);
    }
  });
});

describe('MonthGrid behaviour', () => {
  // A fixed "today" so the today marker is deterministic.
  const TODAY = new Date(2023, 9, 10); // Tue Oct 10 2023

  beforeEach(() => {
    jest.useFakeTimers({ now: TODAY });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderGrid(props: Partial<MonthGridProps> = {}) {
    const onSelectDay = jest.fn();
    render(
      <MonthGrid
        month={new Date(2023, 9, 1)}
        selectedDay={new Date(2023, 9, 15)}
        onSelectDay={onSelectDay}
        {...props}
      />,
    );
    // Cells render once the grid has measured its width.
    fireEvent(screen.getByTestId('month-grid-days'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 326, height: 0 } },
    });
    return { onSelectDay };
  }

  const allDayCells = () => screen.getAllByRole('button');

  test.each([
    ['4-row month (Feb 2021)', new Date(2021, 1, 1), 28],
    ['5-row month (Nov 2023)', new Date(2023, 10, 1), 35],
    ['6-row month (Oct 2023)', new Date(2023, 9, 1), 42],
  ])('renders one cell per day of a %s', (_, month, expectedCells) => {
    renderGrid({ month });

    expect(allDayCells()).toHaveLength(expectedCells);
  });

  test('includes leading and trailing days from adjacent months', () => {
    renderGrid();

    // October 2023's grid runs Mon Sep 25 - Sun Nov 5.
    expect(screen.getByLabelText('Monday, September 25, 2023')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday, November 5, 2023')).toBeOnTheScreen();
  });

  test('marks today and the selected day distinctly', () => {
    renderGrid();

    const today = screen.getByLabelText('Tuesday, October 10, 2023, today');
    const selected = screen.getByLabelText('Sunday, October 15, 2023');
    const ordinary = screen.getByLabelText('Monday, October 16, 2023');

    expect(today).not.toBeSelected();
    expect(selected).toBeSelected();
    expect(ordinary).not.toBeSelected();
    expect(screen.getAllByRole('button', { selected: true })).toEqual([selected]);
    expect(screen.getAllByLabelText(/, today/)).toEqual([today]);
  });

  test('a day that is both today and selected carries both markers', () => {
    renderGrid({ selectedDay: TODAY });

    expect(screen.getByLabelText('Tuesday, October 10, 2023, today')).toBeSelected();
  });

  test('renders category dots for days with events and none for days without', () => {
    renderGrid({
      eventCountsByDay: new Map([
        ['2023-10-12', 3],
        ['2023-10-20', 1],
      ]),
      eventCategoriesByDay: new Map<string, EventCategory[]>([
        ['2023-10-12', ['work', 'health']],
        ['2023-10-20', ['social']],
      ]),
    });

    const busyDay = screen.getByLabelText('Thursday, October 12, 2023, 3 events');
    expect(within(busyDay).getByTestId('category-dot-work')).toBeOnTheScreen();
    expect(within(busyDay).getByTestId('category-dot-health')).toBeOnTheScreen();
    expect(within(busyDay).queryAllByTestId(/^category-dot-/)).toHaveLength(2);

    const oneEvent = screen.getByLabelText('Friday, October 20, 2023, 1 event');
    expect(within(oneEvent).queryAllByTestId(/^category-dot-/)).toHaveLength(1);

    const quietDay = screen.getByLabelText('Wednesday, October 11, 2023');
    expect(within(quietDay).queryAllByTestId(/^category-dot-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^category-dot-/)).toHaveLength(3);
  });

  test('shows at most three dots however many categories a day has', () => {
    renderGrid({
      eventCountsByDay: new Map([['2023-10-12', 5]]),
      eventCategoriesByDay: new Map<string, EventCategory[]>([
        ['2023-10-12', ['work', 'personal', 'health', 'social']],
      ]),
    });

    const busyDay = screen.getByLabelText('Thursday, October 12, 2023, 5 events');
    expect(within(busyDay).queryAllByTestId(/^category-dot-/)).toHaveLength(3);
  });

  test('calls onSelectDay with the pressed date, including days outside the month', () => {
    const { onSelectDay } = renderGrid();

    fireEvent.press(screen.getByLabelText('Wednesday, October 18, 2023'));
    fireEvent.press(screen.getByLabelText('Thursday, November 2, 2023'));

    expect(onSelectDay).toHaveBeenNthCalledWith(1, new Date(2023, 9, 18));
    expect(onSelectDay).toHaveBeenNthCalledWith(2, new Date(2023, 10, 2));
  });
});
