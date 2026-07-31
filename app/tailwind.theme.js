/**
 * Shared Tailwind/NativeWind color theme.
 *
 * Every semantic color below resolves through a CSS custom property
 * defined in global.css (`:root` = light, `.dark` = dark), using the
 * official Tailwind CSS-variable-with-opacity pattern:
 *   https://tailwindcss.com/docs/customizing-colors#using-css-variables
 * CSS vars hold "R G B" triplets so Tailwind can substitute
 * `<alpha-value>` for opacity modifiers like `bg-accent/10`.
 *
 * Because NativeWind toggles the `.dark` class on the root, any
 * component using `bg-canvas`, `text-primary`, `border-border`,
 * `bg-accent/10`, etc. automatically repaints correctly in both light
 * and dark mode with zero per-component `dark:` overrides needed for
 * these tokens.
 *
 * IMPORTANT: this file was previously required from a path outside
 * the project root (`../tailwind.theme.js` — one directory above this
 * repo), which does not exist. That silently broke every one of these
 * semantic color classes across the whole app (settings, auth,
 * dashboard, bill details, etc.) — which is exactly why text/surfaces
 * were invisible or wrong in dark mode while raw Tailwind colors
 * (e.g. `neutral-900`) still worked. Fixed by defining the theme here,
 * inside the project, and pointing tailwind.config.js at it.
 */

function withOpacity(variableName) {
  return `rgb(var(${variableName}) / <alpha-value>)`;
}

module.exports = {
  colors: {
    canvas:  withOpacity("--color-canvas"),
    surface: withOpacity("--color-surface"),
    input:   withOpacity("--color-input"),
    border:  withOpacity("--color-border"),
    "toggle-active": withOpacity("--color-toggle-active"),

    primary:   withOpacity("--color-primary"),
    secondary: withOpacity("--color-secondary"),

    accent:         withOpacity("--color-accent"),
    "accent-hover": withOpacity("--color-accent-hover"),
    // Already a pre-mixed rgba() value in global.css — not an RGB triplet —
    // so it is used as-is and does not support opacity modifiers.
    "accent-muted": "var(--color-accent-muted)",
    "accent-text":  withOpacity("--color-accent-text"),

    error:   withOpacity("--color-error"),
    success: withOpacity("--color-success"),
    warning: withOpacity("--color-warning"),
  },
  spacing: {},
  borderRadius: {
    none:  "0px",
    sm:    "4px",
    input: "8px",
    card:  "12px",
    sheet: "16px",
    pill:  "9999px",
  },
  boxShadow: {
    resting: "0 1px 2px rgba(0,0,0,0.04)",
    raised:  "0 4px 16px rgba(0,0,0,0.10)",
  },
  fontFamily: {},
};
