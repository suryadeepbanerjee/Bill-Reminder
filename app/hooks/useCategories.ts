import { useQuery } from "@tanstack/react-query";
import { fetchCategoryPresets, fetchHouseholdCategories } from "../lib/supabase/categories";
import { useHousehold } from "./useHousehold";

export function useCategoryPresets() {
  return useQuery({
    queryKey: ["categoryPresets"],
    queryFn:  fetchCategoryPresets,
    staleTime: 24 * 60 * 60 * 1000, // presets rarely change
  });
}

export function useHouseholdCategories() {
  const { activeHousehold } = useHousehold();
  const householdId = activeHousehold?.household.id;

  return useQuery({
    queryKey: ["householdCategories", householdId],
    queryFn:  () => fetchHouseholdCategories(householdId!),
    enabled:  Boolean(householdId),
  });
}
