export const colors = {
  /** Page/screen background - a light warm grey, not white. Cards sit on
   * top of this in `card`. */
  background: '#F3EFE8',
  /** Card surfaces: white, on top of the warm-grey `background`. */
  card: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E1E4E8',

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
