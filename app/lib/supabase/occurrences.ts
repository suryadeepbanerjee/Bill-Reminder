import { supabase } from "./client";
import { guardAsync } from "@shared/utils/action-guard";
import { createOccurrencesApi } from "@shared/supabase/occurrences";
import type { MarkPaidInput, DeleteTransactionInput } from "@shared/types";

const api = createOccurrencesApi(supabase);

export const fetchDashboardData = api.fetchDashboardData;
export const fetchBillOccurrences = api.fetchBillOccurrences;
export const fetchCurrentOccurrence = api.fetchCurrentOccurrence;

export function markOccurrencePaid(input: MarkPaidInput): Promise<void> {
  return guardAsync(`mut:mark-paid:${input.occurrence_id}`, () =>
    api.markOccurrencePaid(input)
  ) as Promise<void>;
}

export function deleteOccurrenceTransaction(input: DeleteTransactionInput): Promise<void> {
  return guardAsync(`mut:delete-tx:${input.occurrence_id}`, () =>
    api.deleteOccurrenceTransaction(input)
  ) as Promise<void>;
}

export type { DashboardData } from "@shared/supabase/occurrences";
