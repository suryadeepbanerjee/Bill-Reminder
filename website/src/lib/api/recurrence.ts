import { supabase } from "../supabase";
import { createRecurrenceApi, buildPreviewParams } from "@shared/supabase/recurrence";
import type { RecurrencePreviewParams } from "@shared/supabase/recurrence";

const api = createRecurrenceApi(supabase);

export const fetchRecurrencePreview = api.fetchRecurrencePreview;
export { buildPreviewParams };
export type { RecurrencePreviewParams };