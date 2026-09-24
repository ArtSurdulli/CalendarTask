import type { EventCategory } from '../types';

/**
 * One muted colour per event category, distinct from `colors.accent`
 * (primary actions, today ring) so category colour doesn't get confused
 * with it. Deliberately desaturated - these show up as small dots and
 * thin accents, not blocks of colour.
 */
export const categoryColors: Record<EventCategory, string> = {
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
export const categoryColorsTint: Record<EventCategory, string> = {
  work: '#E4E9EF',
  personal: '#EDE8F3',
  health: '#E5F0E8',
  social: '#F5EAE1',
  other: '#EAEAEC',
};
