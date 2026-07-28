/** 
 * Shared Design System Theme for Bill Reminder Ecosystem
 * Imported by both Mobile App (NativeWind) and Website (React/Vite).
 */

const colors = {
  // Using CSS Variables for dynamic Light/Dark mode switching
  canvas: "var(--color-canvas)",
  surface: "var(--color-surface)",
  input: "var(--color-input)",
  border: "var(--color-border)",
  
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  
  accent: {
    DEFAULT: "var(--color-accent)",
    hover: "var(--color-accent-hover)",
    muted: "var(--color-accent-muted)",
    text: "var(--color-accent-text)",
  },
  
  // States (using a refined palette instead of generic Tailwind colors)
  error: {
    DEFAULT: "#DC2626",
    surface: "rgba(220, 38, 38, 0.1)",
  },
  success: {
    DEFAULT: "#10B981",
    surface: "rgba(16, 185, 129, 0.1)",
  },
  warning: {
    DEFAULT: "#F59E0B",
    surface: "rgba(245, 158, 11, 0.1)",
  }
};

const spacing = {
  0.5: "2px",
  1:   "4px",
  1.5: "6px",
  2:   "8px",
  3:   "12px",
  4:   "16px",
  5:   "20px",
  6:   "24px",
  7:   "28px",
  8:   "32px",
  10:  "40px",
  12:  "48px",
  14:  "56px",
  16:  "64px",
  20:  "80px",
  24:  "96px",
  32:  "128px",
  // Semantic spacing
  "touch-min": "44px",
  "tab-bar":   "80px",
};

const borderRadius = {
  none:  "0px",
  sm:    "4px",
  input: "8px",
  card:  "12px",
  sheet: "16px",
  pill:  "99px",
  full:  "9999px",
};

const boxShadow = {
  none: "none",
  resting: "0 1px 2px 0 rgba(0,0,0,0.05)",
  raised:  "0 4px 16px 0 rgba(0,0,0,0.08), 0 1px 4px 0 rgba(0,0,0,0.04)",
  fab:     "0 8px 24px 0 rgba(186,150,24,0.25), 0 2px 8px 0 rgba(0,0,0,0.08)",
};

const fontFamily = {
  sans: ["Geist Sans", "system-ui", "-apple-system", "sans-serif"],
  mono: ["Geist Mono", "monospace"],
};

module.exports = {
  colors,
  spacing,
  borderRadius,
  boxShadow,
  fontFamily,
};
