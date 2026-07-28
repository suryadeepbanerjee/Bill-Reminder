/** @type {import('tailwindcss').Config} */
import sharedTheme from "../tailwind.theme.js";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: sharedTheme.colors,
      spacing: sharedTheme.spacing,
      borderRadius: sharedTheme.borderRadius,
      boxShadow: sharedTheme.boxShadow,
      fontFamily: sharedTheme.fontFamily,
      
      // Website-specific extensions like keyframes for hero
      animation: {
        "gradient-shift": "gradient-shift 8s ease infinite",
        "float": "float 6s cubic-bezier(0.16,1,0.3,1) infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "fade-in": "fade-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "grid-pattern": `linear-gradient(rgba(186,150,24,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(186,150,24,0.04) 1px, transparent 1px)`,
        "radial-glow": "radial-gradient(ellipse at center, rgba(186,150,24,0.15) 0%, transparent 70%)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT:  "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
