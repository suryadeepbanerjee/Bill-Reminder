import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Household, HouseholdMember } from "@shared/types";

const STORAGE_KEY = "br_active_household";

export interface HouseholdWithMember {
  household: Household;
  member:    HouseholdMember;
}

interface HouseholdState {
  households:       HouseholdWithMember[];
  activeHousehold:  HouseholdWithMember | null;
  isLoading:        boolean;

  setHouseholds:    (list: HouseholdWithMember[]) => void;
  setActiveHousehold: (hh: HouseholdWithMember) => Promise<void>;
  loadActive:       () => Promise<void>;
  reset:            () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  households:      [],
  activeHousehold: null,
  isLoading:       true,

  setHouseholds: (list) => {
    set({ households: list });
  },

  setActiveHousehold: async (hh) => {
    set({ activeHousehold: hh });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  loadActive: async () => {
    try {
      const storedId = await SecureStore.getItemAsync(STORAGE_KEY);
      const { households } = get();
      if (households.length === 0) return;

      const match = households.find(h => h.household.id === storedId);
      if (match) {
        set({ activeHousehold: match, isLoading: false });
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
    set({ households: [], activeHousehold: null, isLoading: true });
    SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  },
}));
