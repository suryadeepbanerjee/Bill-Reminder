import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  hydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  applyResolved: (mode: ThemeMode) => void;
  _hydrate: () => Promise<void>;
}

const STORAGE_KEY = "br_theme_mode";

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  resolved: "light",
  hydrated: false,

  // Records the *intent* and applies it immediately. ThemeTransition used to
  // own the delayed `resolved` swap; since it is no longer rendered, mode and
  // resolved must move together or a toggle would do nothing.
  setMode: async (mode) => {
    set({ mode, resolved: mode });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    } catch {
      // Non-critical
    }
  },

  applyResolved: (mode) => set({ resolved: mode }),

  _hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const mode: ThemeMode = stored === "dark" ? "dark" : "light";
      set({ mode, resolved: mode, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
