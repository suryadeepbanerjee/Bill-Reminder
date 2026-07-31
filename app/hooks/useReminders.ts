import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  toggleReminderRule,
} from "../lib/supabase/reminders";
import type { BillReminderRule } from "../lib/supabase/types";

export function useReminderRules(billId: string | undefined) {
  return useQuery({
    queryKey: ["reminderRules", billId],
    queryFn:  () => fetchReminderRules(billId!),
    enabled:  Boolean(billId),
  });
}

export function useCreateReminderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BillReminderRule, "id">) => createReminderRule(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules", input.bill_id] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}

export function useUpdateReminderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, billId }: {
      id:     string;
      input:  Partial<Omit<BillReminderRule, "id" | "bill_id">>;
      billId: string;
    }) => updateReminderRule(id, input),
    onSuccess: (_data, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules", billId] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}

export function useDeleteReminderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; billId: string }) => deleteReminderRule(id),
    onSuccess: (_data, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules", billId] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}

export function useToggleReminderRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean; billId: string }) =>
      toggleReminderRule(id, enabled),
    onSuccess: (_data, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules", billId] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}
