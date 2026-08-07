import { useThemeStore } from "../stores/theme-store";

/**
 * Single source of truth for the runtime-resolved color palette.
 *
 * The whole app is themed through CSS variables (global.css) that NativeWind
 * swaps atomically. Named-screen pieces that need a literal color (React
 * Navigation tab bar / native headers) MUST read from here so they switch in
 * the exact same commit as the CSS variables — otherwise they visibly swap
 * a frame ahead/behind the page and the theme change looks staggered.
 *
 * Keep the values in lockstep with the `--color-*` variables in global.css.
 */

const TOKENS = {
  light: {
    canvas:    "#F9FAFB", // --color-canvas: 249 250 251
    surface:   "#FFFFFF", // --color-surface
    input:     "#F3F4F6", // --color-input
    border:    "#E5E7EB", // --color-border
    primary:   "#111827", // --color-primary
    secondary: "#4B5563", // --color-secondary
    accent:    "#BA9618", // --color-accent
    error:     "#DC2626",
    success:   "#10B981",
    warning:   "#F59E0B",
  },
  dark: {
    canvas:    "#121212", // --color-canvas: 18 18 18
    surface:   "#1E1E1E", // --color-surface
    input:     "#2C2C2C", // --color-input: 44 44 44
    border:    "#333333", // --color-border
    primary:   "#F9FAFB", // --color-primary
    secondary: "#9CA3AF", // --color-secondary
    accent:    "#D1A920", // --color-accent
    error:     "#F87171",
    success:   "#34D399",
    warning:   "#FBBF24",
  },
} as const;

type Resolved = keyof typeof TOKENS;

export function useAppTokens(): (typeof TOKENS)[Resolved] {
  const resolved = useThemeStore((s) => s.resolved);
  return TOKENS[resolved];
}

export function tokensFor(resolved: Resolved): (typeof TOKENS)[Resolved] {
  return TOKENS[resolved];
}