import { create } from "zustand";
import type { Household, HouseholdMember } from "../lib/types";

const STORAGE_KEY = "br_active_household";

export interface HouseholdWithMember {
  household: Household;
  member:    HouseholdMember;
}

interface HouseholdState {
  households:        HouseholdWithMember[];
  activeHousehold:   HouseholdWithMember | null;
  isLoading:         boolean;

  setHouseholds:     (list: HouseholdWithMember[]) => void;
  setActiveHousehold: (hh: HouseholdWithMember) => void;
  loadActive:        () => void;
  reset:             () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  households:      [],
  activeHousehold: null,
  isLoading:       true,

  setHouseholds: (list) => {
    set({ households: list });
  },

  setActiveHousehold: (hh) => {
    set({ activeHousehold: hh });
    try {
      localStorage.setItem(STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  loadActive: () => {
    try {
      const storedId = localStorage.getItem(STORAGE_KEY);
      const { households } = get();
      if (households.length === 0) return;

      const match = households.find((h) => h.household.id === storedId);
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* non-critical */ }
  },
}));