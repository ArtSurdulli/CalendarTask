import { useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from '../../app/useReduceMotion';
import { motion } from '../../theme';

export type ViewMode = 'month' | 'day';

/**
 * Month/Day switching with a cross-fade. During a transition the previous
 * mode stays mounted (`outgoingMode`) while the two fade past each other.
 * Under Reduce Motion the switch is instant.
 *
 * Each mode has its own opacity value that stays bound to that mode's
 * layer for its whole life, so a switch never rebinds a visible layer to a
 * different value (which would snap it to that value's opacity for a
 * frame). The incoming value is set to 0 before its layer mounts, so its
 * first paint is already transparent.
 *
 * JS-driven rather than native-driven: with the native driver the JS copy
 * of a value goes stale mid-animation, and any re-render during the fade
 * (e.g. switching back) re-applies that stale opacity for a frame. Two
 * opacity values for 200ms are cheap on the JS thread.
 */
export function useViewModeCrossFade(initialMode: ViewMode) {
  const reduceMotion = useReduceMotion();
  const [viewMode, setViewMode] = useState(initialMode);
  const [outgoingMode, setOutgoingMode] = useState<ViewMode | null>(null);
  const opacities = useRef<Record<ViewMode, Animated.Value>>({
    month: new Animated.Value(initialMode === 'month' ? 1 : 0),
    day: new Animated.Value(initialMode === 'day' ? 1 : 0),
  }).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const changeViewMode = (next: ViewMode) => {
    if (next === viewMode) {
      return;
    }
    const previous = viewMode;
    running.current?.stop();

    if (reduceMotion) {
      opacities[next].setValue(1);
      opacities[previous].setValue(0);
      setOutgoingMode(null);
      setViewMode(next);
      return;
    }

    // Switching back mid-transition: `next` is the layer still fading out,
    // already mounted and part-way visible - continue from where it is.
    // Otherwise it's about to mount, and must mount transparent.
    if (next !== outgoingMode) {
      opacities[next].setValue(0);
    }
    setOutgoingMode(previous);
    setViewMode(next);

    const timing = { duration: motion.duration.fast, useNativeDriver: false };
    const animation = Animated.parallel([
      Animated.timing(opacities[next], { ...timing, toValue: 1 }),
      Animated.timing(opacities[previous], { ...timing, toValue: 0 }),
    ]);
    running.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        running.current = null;
        setOutgoingMode(null);
      }
    });
  };

  return { viewMode, outgoingMode, opacities, changeViewMode };
}
