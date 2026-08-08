import { create } from "zustand";
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
  setActiveHousehold:    (hh: HouseholdWithMember) => void;
  setDefaultHousehold:   (hh: HouseholdWithMember) => void;
  loadActive:            () => void;
  reset:                 () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  households:        [],
  activeHousehold:   null,
  defaultHouseholdId: null,
  isLoading:         true,

  setHouseholds: (list) => {
    set((state) => {
      let defaultId = state.defaultHouseholdId;
      if (defaultId && !list.some((h) => h.household.id === defaultId)) {
        defaultId = null;
        try {
          localStorage.removeItem(DEFAULT_STORAGE_KEY);
        } catch { /* non-critical */ }
      }
      // A lone household (e.g. the one ensureAtLeastOneHousehold auto-creates)
      // is always the default unless the user has explicitly picked another.
      if (!defaultId && list.length === 1) {
        defaultId = list[0].household.id;
        try {
          localStorage.setItem(DEFAULT_STORAGE_KEY, defaultId);
        } catch { /* non-critical */ }
      }
      return { households: list, defaultHouseholdId: defaultId };
    });
  },

  setActiveHousehold: (hh) => {
    set({ activeHousehold: hh });
    try {
      localStorage.setItem(STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  setDefaultHousehold: (hh) => {
    set({ defaultHouseholdId: hh.household.id });
    try {
      localStorage.setItem(DEFAULT_STORAGE_KEY, hh.household.id);
    } catch { /* non-critical */ }
  },

  loadActive: () => {
    try {
      const storedId  = localStorage.getItem(STORAGE_KEY);
      const defaultId = localStorage.getItem(DEFAULT_STORAGE_KEY);
      const { households } = get();
      if (households.length === 0) {
        // No households left (left / kicked) — allow the shell to render an
        // empty state until ensureAtLeastOneHousehold creates a default one.
        set({ activeHousehold: null, isLoading: false });
        return;
      }

      const match =
        households.find((h) => h.household.id === defaultId) ??
        households.find((h) => h.household.id === storedId) ??
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
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEFAULT_STORAGE_KEY);
    } catch { /* non-critical */ }
  },
}));