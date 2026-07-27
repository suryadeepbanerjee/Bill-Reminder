/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Neutral ramp (base surface + text) ───────────────────────────
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
        // ── Accent — single action hue (desaturated indigo) ───────────────
        accent: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#5B5BD6",   // ← primary action color
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        // ── State: overdue / warning ───────────────────────────────────────
        amber: {
          50:  "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        // ── State: paid / success ─────────────────────────────────────────
        emerald: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        // ── State: upcoming / info ────────────────────────────────────────
        sky: {
          50:  "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
        },
        // ── Error / destructive ───────────────────────────────────────────
        red: {
          50:  "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          400: "#F87171",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },

      // ── Typography — exact spec values ────────────────────────────────
      fontFamily: {
        sans: ["System"],
        mono: ["SpaceMono", "monospace"],
      },
      fontSize: {
        display: ["28px", { lineHeight: "34px", fontWeight: "700", letterSpacing: "-0.3px" }],
        title:   ["22px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.2px" }],
        body:    ["17px", { lineHeight: "24px", fontWeight: "400" }],
        label:   ["15px", { lineHeight: "20px", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        // Amount display (tabular figures)
        amount:  ["20px", { lineHeight: "24px", fontWeight: "600", letterSpacing: "-0.2px" }],
        "amount-lg": ["28px", { lineHeight: "34px", fontWeight: "700", letterSpacing: "-0.5px" }],
      },

      // ── Spacing — 4px base unit ────────────────────────────────────────
      spacing: {
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
        // Semantic spacing
        "touch-min": "44px",   // minimum touch target
        "tab-bar":   "80px",   // tab bar height safe area
      },

      // ── Border radius ─────────────────────────────────────────────────
      borderRadius: {
        none:  "0px",
        sm:    "4px",
        input: "8px",   // inputs & buttons
        card:  "12px",  // cards — slightly more generous
        sheet: "16px",  // bottom sheets
        pill:  "999px", // tags, badges only
        full:  "9999px",
      },

      // ── Elevation shadows (two levels only, per spec) ─────────────────
      boxShadow: {
        none:    "none",
        // Level 1 — resting cards (hairline border preferred, shadow only on floating elements)
        resting: "0 1px 2px 0 rgba(0,0,0,0.04)",
        // Level 2 — raised modals, sheets, FAB
        raised:  "0 4px 16px 0 rgba(0,0,0,0.10), 0 1px 4px 0 rgba(0,0,0,0.06)",
        // FAB shadow
        fab:     "0 4px 12px 0 rgba(91,91,214,0.30), 0 1px 3px 0 rgba(0,0,0,0.08)",
      },

      // ── Motion — 150-200ms ease-out only ──────────────────────────────
      transitionDuration: {
        DEFAULT: "150ms",
        fast:    "100ms",
        base:    "150ms",
        slow:    "200ms",
      },
      transitionTimingFunction: {
        DEFAULT:  "cubic-bezier(0,0,0.2,1)",
        "ease-out": "cubic-bezier(0,0,0.2,1)",
        "ease-in":  "cubic-bezier(0.4,0,1,1)",
        "ease-both":"cubic-bezier(0.4,0,0.2,1)",
      },
    },
  },
  plugins: [],
};
