import { supabase } from "./client";
import type { BillReminderRule } from "./types";

export async function fetchReminderRules(billId: string): Promise<BillReminderRule[]> {
  const { data, error } = await supabase
    .from("bill_reminder_rules")
    .select("*")
    .eq("bill_id", billId)
    .order("anchor")
    .order("offset_days");

  if (error) throw new Error(error.message);
  return (data ?? []) as BillReminderRule[];
}

export async function createReminderRule(
  input: Omit<BillReminderRule, "id">
): Promise<BillReminderRule> {
  const { data, error } = await supabase
    .from("bill_reminder_rules")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BillReminderRule;
}

export async function updateReminderRule(
  id:    string,
  input: Partial<Omit<BillReminderRule, "id" | "bill_id">>
): Promise<BillReminderRule> {
  const { data, error } = await supabase
    .from("bill_reminder_rules")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BillReminderRule;
}

export async function deleteReminderRule(id: string): Promise<void> {
  const { error } = await supabase
    .from("bill_reminder_rules")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function toggleReminderRule(id: string, enabled: boolean): Promise<BillReminderRule> {
  return updateReminderRule(id, { enabled });
}

/** Default reminder rules to create for a new bill */
export function defaultReminderRules(
  billId: string
): Omit<BillReminderRule, "id">[] {
  return [
    {
      bill_id:               billId,
      anchor:                "due_date",
      offset_days:           -3,
      repeat_interval_hours: null,
      repeat_cap:            null,
      channel:               "push",
      enabled:               true,
    },
    {
      bill_id:               billId,
      anchor:                "due_date",
      offset_days:           0,
      repeat_interval_hours: null,
      repeat_cap:            null,
      channel:               "both",
      enabled:               true,
    },
  ];
}
