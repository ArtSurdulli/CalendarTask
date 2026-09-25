export const colors = {
  /** Page/screen background - a light warm grey, not white. Cards sit on
   * top of this in `card`. */
  background: '#F3EFE8',
  /** Card surfaces: white, on top of the warm-grey `background`. */
  card: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E1E4E8',
  /**
   * Divider pair for grids drawn straight on `background`, where `border`
   * (~1.1:1 against it) is too faint to read as a hairline - e.g. the day
   * schedule. `borderStrong` (~1.75:1, on par with the iOS separator) marks
   * primary lines; `borderSubtle` (~1.35:1) marks secondary ones, visibly
   * weaker but still clear.
   */
  borderStrong: '#C0B6A6',
  borderSubtle: '#D6CEC1',

  textPrimary: '#1A1D1F',
  textSecondary: '#6B7280',
  textMuted: '#B0B4BA',

  /** Text/content drawn on top of a filled/dark surface. */
  onPrimary: '#FFFFFF',

  /**
   * The single accent colour: primary actions (buttons, links, the boot
   * spinner) and the today ring in the calendar grid. Deliberately a
   * different hue from `textPrimary`, which is reserved for the
   * selected-day fill, so the ring still reads clearly when a cell is
   * both selected and today.
   */
  accent: '#FF6B35',
  /** Soft tint of `accent` - a selected-but-not-filled state, e.g. the
   * active tab bar pill. */
  accentTint: '#FDE6D9',

  /** Validation/form errors. */
  danger: '#D92D20',

  /** Base colour for card drop shadows (see theme/shadows.ts). */
  shadow: '#000000',
} as const;
