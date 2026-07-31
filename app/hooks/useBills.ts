import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBills,
  fetchBillById,
  createBill,
  updateBill,
  deleteBill,
} from "../lib/supabase/bills";
import { useHousehold } from "./useHousehold";
import type { CreateBillInput, UpdateBillInput } from "../lib/supabase/types";

export function useBills() {
  const { activeHousehold } = useHousehold();
  const householdId = activeHousehold?.household.id;

  return useQuery({
    queryKey: ["bills", householdId],
    queryFn:  () => fetchBills(householdId!),
    enabled:  Boolean(householdId),
  });
}

export function useBill(billId: string | undefined) {
  return useQuery({
    queryKey: ["bill", billId],
    queryFn:  () => fetchBillById(billId!),
    enabled:  Boolean(billId),
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBillInput) => createBill(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBillInput }) =>
      updateBill(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (billId: string) => deleteBill(billId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}
