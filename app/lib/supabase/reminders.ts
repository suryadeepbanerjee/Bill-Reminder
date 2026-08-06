import { supabase } from "./client";
import { guardAsync } from "@shared/utils/action-guard";
import { createRemindersApi, defaultReminderRules } from "@shared/supabase/reminders";
import type { BillReminderRule } from "@shared/types";

const api = createRemindersApi(supabase);

export const fetchSyncData = api.fetchSyncData;
export const fetchReminderRules = api.fetchReminderRules;

export function createReminderRule(
  input: Omit<BillReminderRule, "id">
): Promise<BillReminderRule> {
  return guardAsync(`mut:create-reminder:${input.bill_id}:${JSON.stringify(input)}`, () =>
    api.createReminderRule(input)
  ) as Promise<BillReminderRule>;
}

export function updateReminderRule(
  id:    string,
  input: Partial<Omit<BillReminderRule, "id" | "bill_id">>
): Promise<BillReminderRule> {
  return guardAsync(`mut:update-reminder:${id}:${JSON.stringify(input)}`, () =>
    api.updateReminderRule(id, input)
  ) as Promise<BillReminderRule>;
}

export function deleteReminderRule(id: string): Promise<void> {
  return guardAsync(`mut:delete-reminder:${id}`, () =>
    api.deleteReminderRule(id)
  ) as Promise<void>;
}

export function toggleReminderRule(id: string, enabled: boolean): Promise<BillReminderRule> {
  return updateReminderRule(id, { enabled });
}

export { defaultReminderRules };

export type { SyncData } from "@shared/supabase/reminders";
