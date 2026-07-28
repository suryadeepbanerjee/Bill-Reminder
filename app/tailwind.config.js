/** @type {import('tailwindcss').Config} */
const sharedTheme = require("../tailwind.theme.js");

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: sharedTheme.colors,
      spacing: sharedTheme.spacing,
      borderRadius: sharedTheme.borderRadius,
      boxShadow: sharedTheme.boxShadow,
      fontFamily: sharedTheme.fontFamily,
      
      // Keep mobile-specific typographic values here if needed, or unify completely.
      fontSize: {
        display: ["28px", { lineHeight: "34px", fontWeight: "700", letterSpacing: "-0.3px" }],
        title:   ["22px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.2px" }],
        body:    ["17px", { lineHeight: "24px", fontWeight: "400" }],
        label:   ["15px", { lineHeight: "20px", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        amount:  ["20px", { lineHeight: "24px", fontWeight: "600", letterSpacing: "-0.2px" }],
        "amount-lg": ["28px", { lineHeight: "34px", fontWeight: "700", letterSpacing: "-0.5px" }],
      },
      
      transitionDuration: {
        DEFAULT: "150ms",
        fast:    "100ms",
        slow:    "200ms",
      },
      transitionTimingFunction: {
        DEFAULT:  "cubic-bezier(0.16,1,0.3,1)",
        "ease-out": "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
