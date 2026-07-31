import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => Promise<void>;
  _hydrate: () => Promise<void>;
}

const STORAGE_KEY = "br_theme_mode";

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  resolved: "light",

  setMode: async (mode) => {
    set({ mode, resolved: mode });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    } catch {
      // Non-critical
    }
  },

  _hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const mode: ThemeMode = stored === "dark" ? "dark" : "light";
      set({ mode, resolved: mode });
    } catch {
      // Use default (light)
    }
  },
}));
