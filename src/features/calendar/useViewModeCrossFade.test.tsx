import React, { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { type ViewMode, useViewModeCrossFade } from './useViewModeCrossFade';

let mockReduceMotion = false;
jest.mock('../../app/useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion,
}));

const MODES: ViewMode[] = ['month', 'day'];
let mounts: Record<ViewMode, number>;
let changeViewMode: (mode: ViewMode) => void;
let opacities: Record<ViewMode, Animated.Value>;

function Content({ mode }: { mode: ViewMode }) {
  useEffect(() => {
    mounts[mode] += 1;
  }, [mode]);
  return <Text>{mode}</Text>;
}

/** Mirrors CalendarScreen's layer rendering. */
function Harness() {
  const crossFade = useViewModeCrossFade('month');
  changeViewMode = crossFade.changeViewMode;
  opacities = crossFade.opacities;

  return (
    <>
      {MODES.map((mode) => {
        if (mode !== crossFade.viewMode && mode !== crossFade.outgoingMode) {
          return null;
        }
        return (
          <Animated.View key={mode} testID={`layer-${mode}`} style={{ opacity: opacities[mode] }}>
            <Content mode={mode} />
            <Pressable />
          </Animated.View>
        );
      })}
    </>
  );
}

let renderer: ReactTestRenderer.ReactTestRenderer;

function mountedLayers(): ViewMode[] {
  return MODES.filter(
    (mode) => renderer.root.findAll((node) => node.props.testID === `layer-${mode}`).length > 0,
  );
}

/** The opacity a layer's host view was rendered with - i.e. its paint on mount. */
function renderedOpacity(mode: ViewMode): number {
  const host = renderer.root.findAll(
    (node) => node.props.testID === `layer-${mode}` && typeof node.type === 'string',
  )[0];
  return StyleSheet.flatten(host.props.style).opacity as number;
}

/** Current animated value (Animated.Value serialises to its current value). */
function opacity(mode: ViewMode): number {
  return JSON.parse(JSON.stringify(opacities[mode]));
}

function switchTo(mode: ViewMode) {
  ReactTestRenderer.act(() => changeViewMode(mode));
}

function advance(ms: number) {
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReduceMotion = false;
  mounts = { month: 0, day: 0 };
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
});

afterEach(() => {
  ReactTestRenderer.act(() => renderer.unmount());
  jest.useRealTimers();
});

describe('useViewModeCrossFade', () => {
  test('incoming layer first renders transparent; outgoing stays fully visible', () => {
    switchTo('day');

    expect(mountedLayers()).toEqual(['month', 'day']);
    expect(renderedOpacity('day')).toBe(0);
    expect(renderedOpacity('month')).toBe(1);
  });

  test('cross-fades over 200ms, then unmounts the outgoing layer', () => {
    switchTo('day');
    advance(100);
    expect(opacity('day')).toBeGreaterThan(0);
    expect(opacity('day')).toBeLessThan(1);
    expect(opacity('month')).toBeGreaterThan(0);
    expect(opacity('month')).toBeLessThan(1);

    advance(200);
    expect(opacity('day')).toBe(1);
    expect(opacity('month')).toBe(0);
    expect(mountedLayers()).toEqual(['day']);
  });

  test('switching back mid-fade continues from the current opacity, in both directions', () => {
    switchTo('day');
    advance(100);
    const monthBefore = opacity('month');
    const dayBefore = opacity('day');

    switchTo('month');
    // No jump: both layers hold their opacity at the moment of reversal.
    expect(opacity('month')).toBeCloseTo(monthBefore, 5);
    expect(opacity('day')).toBeCloseTo(dayBefore, 5);
    expect(renderedOpacity('month')).toBeCloseTo(monthBefore, 5);
    expect(renderedOpacity('day')).toBeCloseTo(dayBefore, 5);

    advance(50);
    const monthMid = opacity('month');
    expect(monthMid).toBeGreaterThan(monthBefore);

    switchTo('day');
    expect(opacity('month')).toBeCloseTo(monthMid, 5);

    advance(300);
    expect(opacity('day')).toBe(1);
    expect(opacity('month')).toBe(0);
    expect(mountedLayers()).toEqual(['day']);
  });

  test('rapid back-and-forth never remounts a layer still on screen', () => {
    for (let i = 0; i < 6; i += 1) {
      switchTo(i % 2 === 0 ? 'day' : 'month');
      advance(30);
    }
    // month mounted once initially; day mounted once on the first switch and
    // stayed mounted throughout, since every later switch was mid-fade.
    expect(mounts).toEqual({ month: 1, day: 1 });
  });

  test('under Reduce Motion the switch is instant', () => {
    mockReduceMotion = true;
    ReactTestRenderer.act(() => renderer.update(<Harness />));

    switchTo('day');

    expect(mountedLayers()).toEqual(['day']);
    expect(renderedOpacity('day')).toBe(1);
  });
});
