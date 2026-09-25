import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { MonthGrid } from './MonthGrid';

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
