import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Expose EXPO_PUBLIC_* env vars (alongside VITE_*) so the CAPTCHA site key
  // can be configured the same way on web and mobile.
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../packages/shared"),
    },
  },
  server: {
    fs: {
      // The shared package lives outside the project root — allow it in dev.
      allow: [path.resolve(__dirname, "../packages/shared")],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          framer: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
