import { useColorScheme } from 'react-native';
import {
  darkCategoryColors,
  darkCategoryColorsTint,
  lightCategoryColors,
  lightCategoryColorsTint,
  type CategoryPalette,
} from './categoryColors';
import { darkColors, lightColors, type Palette } from './colors';
import { createShadows, type Shadows } from './shadows';

export type ColorScheme = 'light' | 'dark';

/** Everything scheme-dependent. Spacing, radius and motion aren't here - they don't vary. */
export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  categoryColors: CategoryPalette;
  categoryColorsTint: CategoryPalette;
  shadows: Shadows;
}

const themes: Record<ColorScheme, Theme> = {
  light: {
    scheme: 'light',
    colors: lightColors,
    categoryColors: lightCategoryColors,
    categoryColorsTint: lightCategoryColorsTint,
    shadows: createShadows(lightColors, 'light'),
  },
  dark: {
    scheme: 'dark',
    colors: darkColors,
    categoryColors: darkCategoryColors,
    categoryColorsTint: darkCategoryColorsTint,
    shadows: createShadows(darkColors, 'dark'),
  },
};

/**
 * The resolved theme for the system colour scheme. Re-renders when the
 * setting changes. Anything the system doesn't report as dark gets light.
 * Each scheme's theme object is a constant, so it's safe as a memo key.
 */
export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/**
 * Turns a colour-dependent style factory into a hook. The factory runs at
 * most once per scheme for the whole app - the result is cached here, not
 * per component instance - so styles don't rebuild on each render.
 *
 *   const useStyles = makeStyles(({ colors }) => StyleSheet.create({ ... }));
 *   // in a component: const styles = useStyles();
 */
export function makeStyles<T>(factory: (theme: Theme) => T): () => T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return function useStyles(): T {
    const theme = useTheme();
    return (cache[theme.scheme] ??= factory(theme));
  };
}
