import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllUserHouseholds } from "../lib/supabase/profile";
import { useAuthStore } from "../stores/auth-store";
import { useHouseholdStore } from "../stores/household-store";

export function useHousehold() {
  const { user } = useAuthStore();
  const {
    activeHousehold,
    isLoading: storeLoading,
    setHouseholds,
    loadActive,
  } = useHouseholdStore();

  const query = useQuery({
    queryKey: ["households", user?.id],
    queryFn:  async () => {
      const list = await fetchAllUserHouseholds(user!.id);
      setHouseholds(list);
      await loadActive();
      return list;
    },
    enabled:  Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    activeHousehold,
    households:  useHouseholdStore((s) => s.households),
    isLoading:  query.isLoading || storeLoading,
  };
}
