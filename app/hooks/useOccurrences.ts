import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardData,
  fetchBillOccurrences,
  fetchCurrentOccurrence,
  markOccurrencePaid,
  deleteOccurrenceTransaction,
} from "../lib/supabase/occurrences";
import { useHousehold } from "./useHousehold";
import type { MarkPaidInput, DeleteTransactionInput } from "@shared/types";

export function useDashboard() {
  const { activeHousehold } = useHousehold();
  const householdId = activeHousehold?.household.id;

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard"] });
      const snapshot = queryClient.getQueryData(["dashboard"]);
      // Optimistic update: set occurrence state to paid immediately
      queryClient.setQueryData(["dashboard"], (old: any) => {
        if (!old) return old;
        const markPaid = (items: any[]) =>
          items.map((o: any) =>
            o.id === input.occurrence_id
              ? { ...o, state: "paid", paid_at: input.paid_at, paid_amount: input.paid_amount }
              : o
          );
        return {
          ...old,
          today:          markPaid(old.today),
          overdue:        markPaid(old.overdue),
          upcoming:       markPaid(old.upcoming),
          recentlyPaid:   [
            ...markPaid(old.recentlyPaid),
            ...(old.today.find((o: any) => o.id === input.occurrence_id)
              ? [old.today.find((o: any) => o.id === input.occurrence_id)]
              : []),
          ].slice(0, 10),
        };
      });
      return { snapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["currentOccurrence"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
    onError: (_err, _input, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(["dashboard"], context.snapshot);
      }
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteTransactionInput) => deleteOccurrenceTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["currentOccurrence"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}
