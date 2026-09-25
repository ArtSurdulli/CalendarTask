import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { motion } from '../theme';

type StackAnimationOptions = Pick<NativeStackNavigationOptions, 'animation' | 'animationDuration'>;

/**
 * Horizontal push used by every card-style stack screen.
 *
 * On iOS, `slide_from_right` resolves to the native UIKit push, and that
 * push's ~350ms duration can't be changed. `simple_push` is the same
 * right-to-left slide but honours `animationDuration`. Android ignores
 * `animationDuration`; its slide uses the platform's own timing.
 */
export function pushAnimation(reduceMotion: boolean): StackAnimationOptions {
  if (reduceMotion) {
    return { animation: 'none' };
  }
  return Platform.OS === 'ios'
    ? { animation: 'simple_push', animationDuration: motion.duration.standard }
    : { animation: 'slide_from_right' };
}

/**
 * Bottom slide for modal screens. On iOS a `presentation: 'modal'` screen
 * always uses the system sheet animation, which slides up and has a fixed
 * duration; `animation` here mainly sets the Android transition.
 */
export function modalAnimation(reduceMotion: boolean): StackAnimationOptions {
  return reduceMotion ? { animation: 'none' } : { animation: 'slide_from_bottom' };
}
