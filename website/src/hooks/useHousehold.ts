import { useQuery } from "@tanstack/react-query";
import { ensureAtLeastOneHousehold } from "../lib/api/household";
import { useAuthStore } from "../stores/auth-store";
import { useHouseholdStore } from "../stores/household-store";

export function useHousehold() {
  const { user } = useAuthStore();
  const {
    activeHousehold,
    isLoading: storeLoading,
    setHouseholds,
    setActiveHousehold,
    loadActive,
  } = useHouseholdStore();

  const query = useQuery({
    queryKey: ["households", user?.id],
    queryFn:  async () => {
      // If the user has no households (left or was kicked out of their default)
      // a fresh default one is created so there's always something to render.
      const list = await ensureAtLeastOneHousehold(user!.id);
      setHouseholds(list);
      loadActive();
      return list;
    },
    enabled:  Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    activeHousehold,
    households: useHouseholdStore((s) => s.households),
    isLoading:  query.isLoading || storeLoading,
    setActiveHousehold,
  };
}