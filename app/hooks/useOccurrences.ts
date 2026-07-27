import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardData,
  fetchBillOccurrences,
  fetchCurrentOccurrence,
  markOccurrencePaid,
} from "../lib/supabase/occurrences";
import { useHousehold } from "./useHousehold";
import type { MarkPaidInput } from "../lib/supabase/types";

export function useDashboard() {
  const { data: householdData } = useHousehold();
  const householdId = householdData?.household.id;

  return useQuery({
    queryKey: ["dashboard", householdId],
    queryFn:  () => fetchDashboardData(householdId!),
    enabled:  Boolean(householdId),
    staleTime: 60 * 1000, // refresh every minute
  });
}

export function useBillOccurrences(billId: string | undefined) {
  return useQuery({
    queryKey: ["occurrences", billId],
    queryFn:  () => fetchBillOccurrences(billId!),
    enabled:  Boolean(billId),
  });
}

export function useCurrentOccurrence(billId: string | undefined) {
  return useQuery({
    queryKey: ["currentOccurrence", billId],
    queryFn:  () => fetchCurrentOccurrence(billId!),
    enabled:  Boolean(billId),
  });
}

export function useMarkPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MarkPaidInput) => markOccurrencePaid(input),
    // Optimistic update — immediately show paid state before server response
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard"] });
      const snapshot = queryClient.getQueryData(["dashboard"]);
      return { snapshot };
    },
    onSuccess: (_data, input) => {
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["currentOccurrence"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (_err, _input, context) => {
      // Roll back optimistic update on failure
      if (context?.snapshot) {
        queryClient.setQueryData(["dashboard"], context.snapshot);
      }
    },
  });
}
