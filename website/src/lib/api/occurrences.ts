import { supabase } from "../supabase";
import { createOccurrencesApi } from "@shared/supabase/occurrences";

const api = createOccurrencesApi(supabase);

export const fetchDashboardData = api.fetchDashboardData;
export const fetchBillOccurrences = api.fetchBillOccurrences;
export const fetchCurrentOccurrence = api.fetchCurrentOccurrence;
export const markOccurrencePaid = api.markOccurrencePaid;
export const deleteOccurrenceTransaction = api.deleteOccurrenceTransaction;

export type { DashboardData } from "@shared/supabase/occurrences";
