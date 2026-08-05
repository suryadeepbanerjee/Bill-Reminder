import { supabase } from "./client";
import { guardAsync } from "../action-guard";
import type { BillOccurrence, BillReminderRule, Bill } from "./types";

export interface SyncData {
  occurrences: (BillOccurrence & { bills: Bill })[];
  rules: BillReminderRule[];
}

export async function fetchSyncData(householdId: string): Promise<SyncData> {
  // Fetch actionable occurrences for the household
  const { data: occurrencesData, error: occError } = await supabase
    .from("bill_occurrences")
    .select("*, bills!inner(*)")
    .in("state", ["upcoming", "generated", "expected_payment", "due_today", "overdue"])
    .eq("bills.household_id", householdId);

  if (occError) throw new Error(occError.message);

  // Fetch enabled rules for the household's bills
  const { data: rulesData, error: ruleError } = await supabase
    .from("bill_reminder_rules")
    .select("*, bills!inner(household_id)")
    .eq("enabled", true)
    .eq("bills.household_id", householdId);

  if (ruleError) throw new Error(ruleError.message);

  return {
    occurrences: (occurrencesData ?? []) as any[],
    rules: (rulesData ?? []) as BillReminderRule[],
  };
}

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
  return guardAsync(`mut:create-reminder:${input.bill_id}:${JSON.stringify(input)}`, async () => {
    const { data, error } = await supabase
      .from("bill_reminder_rules")
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as BillReminderRule;
  }) as Promise<BillReminderRule>;
}

export async function updateReminderRule(
  id:    string,
  input: Partial<Omit<BillReminderRule, "id" | "bill_id">>
): Promise<BillReminderRule> {
  return guardAsync(`mut:update-reminder:${id}:${JSON.stringify(input)}`, async () => {
    const { data, error } = await supabase
      .from("bill_reminder_rules")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as BillReminderRule;
  }) as Promise<BillReminderRule>;
}

export async function deleteReminderRule(id: string): Promise<void> {
  await guardAsync(`mut:delete-reminder:${id}`, async () => {
    const { error } = await supabase
      .from("bill_reminder_rules")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
  });
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
