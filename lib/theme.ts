/**
 * Design Token System — Bill Reminder
 *
 * Primary reference: Things 3 information density + Linear typography restraint
 * Motion: 150-200ms ease-out only, no bounce, no spring
 * Elevation: two levels only — resting (hairline border) and raised (modal/sheet)
 * Color strategy: Restrained — tinted neutrals + single accent (≤10% surface)
 */

// ── Color Palette ───────────────────────────────────────────────────────────

export const Colors = {
  neutral: {
    50:  "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#1C1C1E",
    950: "#0A0A0A",
  },
  // Single action accent — desaturated indigo
  accent: {
    50:  "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#5B5BD6",   // PRIMARY action color
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
    950: "#1E1B4B",
  },
  // State colors — icon + label, not saturated block fills
  amber: {
    50:  "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
  },
  emerald: {
    50:  "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
  },
  sky: {
    50:  "#F0F9FF",
    100: "#E0F2FE",
    200: "#BAE6FD",
    400: "#38BDF8",
    500: "#0EA5E9",
    600: "#0284C7",
  },
  red: {
    50:  "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    400: "#F87171",
    600: "#DC2626",
    700: "#B91C1C",
  },
  white: "#FFFFFF",
  black: "#000000",
} as const;

// ── Semantic Color Tokens ────────────────────────────────────────────────────
// Light mode — dark mode variants handled via tailwind dark: classes in components

export const SemanticColors = {
  light: {
    // Surfaces
    background:    Colors.neutral[50],
    surface:       Colors.white,
    surfaceRaised: Colors.white,
    border:        Colors.neutral[200],
    borderFocused: Colors.accent[500],

    // Text
    textPrimary:   Colors.neutral[900],
    textSecondary: Colors.neutral[500],
    textTertiary:  Colors.neutral[400],
    textDisabled:  Colors.neutral[300],
    textInverse:   Colors.white,
    textAccent:    Colors.accent[500],

    // Action
    accentBg:      Colors.accent[500],
    accentText:    Colors.white,
    accentSubtle:  Colors.accent[50],

    // States
    overdueIcon:   Colors.amber[600],
    overdueBg:     Colors.amber[50],
    paidIcon:      Colors.emerald[600],
    paidBg:        Colors.emerald[50],
    upcomingIcon:  Colors.sky[600],
    upcomingBg:    Colors.sky[50],
    errorIcon:     Colors.red[600],
    errorBg:       Colors.red[50],
  },
  dark: {
    // Surfaces
    background:    Colors.neutral[950],
    surface:       Colors.neutral[900],
    surfaceRaised: Colors.neutral[800],
    border:        Colors.neutral[800],
    borderFocused: Colors.accent[400],

    // Text
    textPrimary:   Colors.neutral[50],
    textSecondary: Colors.neutral[400],
    textTertiary:  Colors.neutral[600],
    textDisabled:  Colors.neutral[700],
    textInverse:   Colors.neutral[900],
    textAccent:    Colors.accent[400],

    // Action
    accentBg:      Colors.accent[500],
    accentText:    Colors.white,
    accentSubtle:  Colors.accent[950],

    // States
    overdueIcon:   Colors.amber[400],
    overdueBg:     "#2A1F00",  // dark amber tint
    paidIcon:      Colors.emerald[400],
    paidBg:        "#00271A",  // dark emerald tint
    upcomingIcon:  Colors.sky[400],
    upcomingBg:    "#001A28",  // dark sky tint
    errorIcon:     Colors.red[400],
    errorBg:       "#2A0000",  // dark red tint
  },
} as const;

// ── Spacing — 4px base unit ──────────────────────────────────────────────────

export const Spacing = {
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  // Semantic
  touchMin: 44,  // minimum touch target (WCAG)
  tabBar:   80,  // tab bar height
} as const;

// ── Border Radius ────────────────────────────────────────────────────────────

export const BorderRadius = {
  none:  0,
  sm:    4,
  input: 8,    // inputs, buttons
  card:  12,   // cards
  sheet: 16,   // bottom sheets, modals
  pill:  999,  // badges, chips only
} as const;

// ── Typography ───────────────────────────────────────────────────────────────

export const FontSize = {
  display:  28,
  title:    22,
  body:     17,
  label:    15,
  caption:  13,
  amount:   20,    // bill amounts — use tabular figures
  amountLg: 28,    // hero amount display
} as const;

export const LineHeight = {
  display:  34,
  title:    28,
  body:     24,
  label:    20,
  caption:  18,
  amount:   24,
  amountLg: 34,
} as const;

export const FontWeight = {
  regular:  "400" as const,
  medium:   "500" as const,
  semibold: "600" as const,
  bold:     "700" as const,
};

// ── Elevation — two levels only, per spec ────────────────────────────────────

export const Shadow = {
  none:    undefined,
  // Level 1: resting — prefer hairline border, shadow only on floating elements
  resting: {
    shadowColor:   "#000000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius:  2,
    elevation:     1,
  },
  // Level 2: raised — modals, bottom sheets, FAB
  raised: {
    shadowColor:   "#000000",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
    elevation:     8,
  },
  // FAB — accent-tinted shadow
  fab: {
    shadowColor:   Colors.accent[500],
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  12,
    elevation:     8,
  },
} as const;

// ── Motion — 150-200ms ease-out only ────────────────────────────────────────

export const Motion = {
  duration: {
    fast:    100,
    base:    150,
    slow:    200,
  },
  easing: {
    easeOut: "cubic-bezier(0, 0, 0.2, 1)" as const,
  },
} as const;

// ── Icon Sizing ───────────────────────────────────────────────────────────────

export const IconSize = {
  xs:  12,
  sm:  16,
  md:  20,
  lg:  24,
  xl:  28,
  "2xl": 32,
} as const;

// ── Z-Index Scale ─────────────────────────────────────────────────────────────

export const ZIndex = {
  base:          0,
  raised:        1,
  dropdown:      100,
  sticky:        200,
  modalBackdrop: 300,
  modal:         400,
  toast:         500,
  tooltip:       600,
} as const;
