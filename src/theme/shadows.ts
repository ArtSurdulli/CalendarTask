import type { ViewStyle } from 'react-native';
import { colors } from './colors';

/**
 * Shared shadow styles for card surfaces. Spread the value into a
 * StyleSheet entry rather than writing shadow properties inline, so the
 * "very soft shadow" look stays consistent everywhere a card appears.
 */
export const shadows: Record<'card', ViewStyle> = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};
