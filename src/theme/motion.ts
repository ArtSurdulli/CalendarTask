import { spacing } from './spacing';

/**
 * Transition timing. Every animation in the app uses one of these so they
 * stay within the same 200-250ms band.
 */
export const motion = {
  duration: {
    /** Cross-fades between sibling views. */
    fast: 200,
    /** Screen pushes and the month-grid slide. */
    standard: 250,
  },
  /** How far the month grid travels as it slides in. */
  slideDistance: spacing.xl,
} as const;
