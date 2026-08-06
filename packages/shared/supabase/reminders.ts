import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillOccurrence, BillReminderRule, Bill } from "../types";

export interface SyncData {
  occurrences: (BillOccurrence & { bills: Bill })[];
  rules: BillReminderRule[];
}

export interface RemindersApi {
  fetchSyncData(householdId: string): Promise<SyncData>;
  fetchReminderRules(billId: string): Promise<BillReminderRule[]>;
  createReminderRule(input: Omit<BillReminderRule, "id">): Promise<BillReminderRule>;
  updateReminderRule(
    id:    string,
    input: Partial<Omit<BillReminderRule, "id" | "bill_id">>
  ): Promise<BillReminderRule>;
  deleteReminderRule(id: string): Promise<void>;
  toggleReminderRule(id: string, enabled: boolean): Promise<BillReminderRule>;
}

/** Client-bound reminder rules data layer. Each platform binds its own client. */
export function createRemindersApi(supabase: SupabaseClient): RemindersApi {
  return {
    async fetchSyncData(householdId: string): Promise<SyncData> {
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
    },

    async fetchReminderRules(billId: string): Promise<BillReminderRule[]> {
      const { data, error } = await supabase
        .from("bill_reminder_rules")
        .select("*")
        .eq("bill_id", billId)
        .order("anchor")
        .order("offset_days");

      if (error) throw new Error(error.message);
      return (data ?? []) as BillReminderRule[];
    },

    async createReminderRule(
      input: Omit<BillReminderRule, "id">
    ): Promise<BillReminderRule> {
      const { data, error } = await supabase
        .from("bill_reminder_rules")
        .insert(input)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as BillReminderRule;
    },

    async updateReminderRule(
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
    },

    async deleteReminderRule(id: string): Promise<void> {
      const { error } = await supabase
        .from("bill_reminder_rules")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
    },

    async toggleReminderRule(id: string, enabled: boolean): Promise<BillReminderRule> {
      return this.updateReminderRule(id, { enabled });
    },
  };
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
