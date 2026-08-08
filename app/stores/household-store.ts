import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Household, HouseholdMember } from "@shared/types";

const STORAGE_KEY         = "br_active_household";
const DEFAULT_STORAGE_KEY = "br_default_household";

export interface HouseholdWithMember {
  household: Household;
  member:    HouseholdMember;
}

interface HouseholdState {
  households:        HouseholdWithMember[];
  activeHousehold:   HouseholdWithMember | null;
  defaultHouseholdId: string | null;
  isLoading:         boolean;

  setHouseholds:         (list: HouseholdWithMember[]) => void;
  setActiveHousehold:    (hh: HouseholdWithMember) => Promise<void>;
  setDefaultHousehold:   (hh: HouseholdWithMember) => Promise<void>;
  loadActive:            () => Promise<void>;
  reset:                 () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  households:        [],
  activeHousehold:   null,
  defaultHouseholdId: null,
  isLoading:         true,

  setHouseholds: (list) => {
    set((s) => {
      const defaultStillExists = !s.defaultHouseholdId || list.some((h) => h.household.id === s.defaultHouseholdId);
      if (!defaultStillExists) {
        SecureStore.deleteItemAsync(DEFAULT_STORAGE_KEY).catch(() => {});
      }
      return {
        households: list,
        defaultHouseholdId: defaultStillExists ? s.defaultHouseholdId : null,
      };
    });
  },

  setActiveHousehold: async (hh) => {
    set({ activeHousehold: hh });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  setDefaultHousehold: async (hh) => {
    set({ defaultHouseholdId: hh.household.id });
    try {
      await SecureStore.setItemAsync(DEFAULT_STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  loadActive: async () => {
    try {
      const [storedId, defaultId] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEY),
        SecureStore.getItemAsync(DEFAULT_STORAGE_KEY),
      ]);
      const { households } = get();
      if (households.length === 0) {
        // No households left (left / kicked) — allow the shell to render a
        // vanishing state until ensureAtLeastOneHousehold creates a default one.
        set({ activeHousehold: null, isLoading: false });
        return;
      }

      const match =
        households.find(h => h.household.id === defaultId) ??
        households.find(h => h.household.id === storedId) ??
        null;
      if (match) {
        set({
          activeHousehold: match,
          defaultHouseholdId: defaultId ?? null,
          isLoading: false,
        });
      } else {
        set({ activeHousehold: households[0], isLoading: false });
      }
    } catch {
      const { households } = get();
      if (households.length > 0) {
        set({ activeHousehold: households[0] });
      }
      set({ isLoading: false });
    }
  },

  reset: () => {
    set({ households: [], activeHousehold: null, defaultHouseholdId: null, isLoading: true });
    SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
    SecureStore.deleteItemAsync(DEFAULT_STORAGE_KEY).catch(() => {});
  },
}));
