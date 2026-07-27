import { create } from "zustand";
import { Appearance, ColorSchemeName } from "react-native";
import * as SecureStore from "expo-secure-store";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  /** resolved scheme based on mode + system preference */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => Promise<void>;
  _hydrate: () => Promise<void>;
}

const STORAGE_KEY = "br_theme_mode";

function resolveScheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  }
  return mode;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",
  resolved: resolveScheme("system"),

  setMode: async (mode) => {
    const resolved = resolveScheme(mode);
    set({ mode, resolved });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    } catch {
      // Non-critical — SecureStore is not available on web/emulator without config, ignore
    }
  },

  _hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const mode: ThemeMode =
        stored === "dark" ? "dark" :
        stored === "light" ? "light" : "system";
      const resolved = resolveScheme(mode);
      set({ mode, resolved });
    } catch {
      // Use default (system)
    }
  },
}));

// Listen to OS-level appearance changes when mode is "system"
Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const { mode } = useThemeStore.getState();
  if (mode === "system") {
    const resolved = colorScheme === "dark" ? "dark" : "light";
    useThemeStore.setState({ resolved });
  }
});
