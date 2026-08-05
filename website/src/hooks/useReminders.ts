import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  toggleReminderRule,
} from "../lib/api/reminders";
import type { BillReminderRule } from "../lib/types";

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
    },
  });
}

export function useUpdateReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<BillReminderRule, "id" | "bill_id">> }) =>
      updateReminderRule(id, input),
    onSuccess: (_data, { input }) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules"] });
    },
  });
}

export function useDeleteReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteReminderRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules"] });
    },
  });
}

export function useToggleReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled, billId }: { id: string; enabled: boolean; billId: string }) =>
      toggleReminderRule(id, enabled),
    onSuccess: (_data, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["reminderRules", billId] });
    },
  });
}