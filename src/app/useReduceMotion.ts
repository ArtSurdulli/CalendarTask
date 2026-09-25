import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS "Reduce Motion" setting is on. Reads the initial value
 * and then subscribes, so toggling it while the app is running takes
 * effect without a restart. Starts `false` until the initial read resolves.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    // A change event that lands before the initial read resolves is newer,
    // so the initial read must not overwrite it.
    let changedSinceMount = false;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changedSinceMount) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changedSinceMount = true;
      if (active) {
        setReduceMotion(enabled);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
