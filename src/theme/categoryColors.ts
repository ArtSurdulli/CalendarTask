import type { EventCategory } from '../types';

export type CategoryPalette = Record<EventCategory, string>;

/**
 * One muted colour per event category, distinct from `colors.accent`
 * (primary actions, today ring) so category colour doesn't get confused
 * with it. Deliberately desaturated - these show up as small dots and
 * thin accents, not blocks of colour.
 */
export const lightCategoryColors: CategoryPalette = {
  work: '#7B8FA6',
  personal: '#9B8AC4',
  health: '#7FAE8E',
  social: '#C99B7A',
  other: '#A0A0A8',
};

/**
 * Pale tint of each category colour, for an unselected chip's fill (a
 * light wash, not a hairline outline). Hand-picked rather than computed
 * at render time, so this stays a theme token like every other colour
 * here. Applied uniformly across all 5 categories - including `other`,
 * whose base colour is already a neutral grey - so none of them reads as
 * more "active"/pre-selected than the rest by default.
 */
export const lightCategoryColorsTint: CategoryPalette = {
  work: '#E4E9EF',
  personal: '#EDE8F3',
  health: '#E5F0E8',
  social: '#F5EAE1',
  other: '#EAEAEC',
};

/**
 * Lighter, slightly more saturated versions for dark surfaces, so the
 * five stay distinguishable and each dot reads at 6:1 or better against
 * the dark card.
 */
export const darkCategoryColors: CategoryPalette = {
  work: '#8FA5C0',
  personal: '#B3A2DD',
  health: '#8DC6A0',
  social: '#E0AF8A',
  other: '#A9A8B2',
};

/** Dark washes of each hue: event-block and chip fills under light text. */
export const darkCategoryColorsTint: CategoryPalette = {
  work: '#2A323C',
  personal: '#332D40',
  health: '#27372D',
  social: '#3D3129',
  other: '#323238',
};
