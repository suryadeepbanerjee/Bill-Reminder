import { useQuery } from "@tanstack/react-query";
import { fetchUserHousehold } from "../lib/supabase/profile";
import { useAuthStore } from "../stores/auth-store";

export function useHousehold() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["household", user?.id],
    queryFn:  () => fetchUserHousehold(user!.id),
    enabled:  Boolean(user?.id),
    staleTime: 5 * 60 * 1000, // household changes rarely
  });
}
