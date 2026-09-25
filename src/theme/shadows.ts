import { StyleSheet, type ViewStyle } from 'react-native';
import type { Palette } from './colors';

export type Shadows = Record<'card', ViewStyle>;

/**
 * Shared card elevation. Spread the value into a style rather than writing
 * shadow properties inline, so cards look the same everywhere.
 *
 * Light: a very soft drop shadow. Dark: a shadow that soft is invisible on
 * a dark page, so cards get a hairline outline instead, with a slightly
 * stronger shadow underneath.
 */
export function createShadows(colors: Palette, scheme: 'light' | 'dark'): Shadows {
  if (scheme === 'dark') {
    return {
      card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 2,
      },
    };
  }
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
  };
}
