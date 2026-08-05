import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecurrencePreviewParams {
  behavior_type:       string;
  repeat_kind:         string;
  repeat_interval?:    number | null;
  due_day_offset?:     number | null;
  anchor_date?:        string | null;   // YYYY-MM-DD
  preview_count?:      number;
}

// ── Supabase RPC call ─────────────────────────────────────────────────────────

async function fetchRecurrencePreview(
  params: RecurrencePreviewParams
): Promise<string[]> {
  const { data, error } = await supabase.rpc("preview_bill_occurrences", {
    p_behavior_type:    params.behavior_type,
    p_repeat_kind:      params.repeat_kind,
    p_repeat_interval:  params.repeat_interval ?? null,
    p_due_day_offset:   params.due_day_offset   ?? null,
    p_validity_days:    null,          // new bills never set validity_days
    p_check_interval_days: null,       // new bills never set check_interval_days
    p_anchor_date:      params.anchor_date ?? null,
    // Use anchor_date if provided so the preview starts exactly from there,
    // avoiding user confusion when past dates are skipped.
    p_preview_from:     (() => {
      if (params.anchor_date) return params.anchor_date;
      const d = new Date();
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    })(),
    p_count:            params.preview_count ?? 5,
  });

  if (error) throw new Error(error.message);

  // The RPC returns a JSON array of date strings (YYYY-MM-DD)
  return (data as string[]) ?? [];
}

// ── React Query hook ──────────────────────────────────────────────────────────

/**
 * Fetches the next N upcoming due dates from the real backend recurrence engine.
 * Returns null while params are incomplete (no network call made).
 *
 * Usage:
 *   const { dates, isLoading } = useRecurrencePreview(previewParams);
 */
export function useRecurrencePreview(params: RecurrencePreviewParams | null) {
  const query = useQuery({
    queryKey: ["recurrence-preview", params],
    queryFn:  () => fetchRecurrencePreview(params!),
    enabled:  params !== null,
    staleTime: 60_000,  // results are stable for 1 min (same-day previews don't change)
    retry: false,
  });

  return {
    dates:     (query.data ?? []) as string[],
    isLoading: query.isFetching,
    error:     query.error as Error | null,
  };
}

// ── Param builder ─────────────────────────────────────────────────────────────

/**
 * Builds RecurrencePreviewParams from raw form values.
 * Returns null if the data is insufficient for a preview (nothing will render).
 */
export function buildPreviewParams(
  behaviorType:   string | undefined,
  repeatKind:     string | undefined,
  repeatInterval: number | null | undefined,
  dueDayOffset:   number | null | undefined,
  anchorDate:     string | null | undefined,
): RecurrencePreviewParams | null {
  if (!behaviorType || !repeatKind) return null;

  // Fixed monthly: need due_day_offset
  if (behaviorType === "fixed_due_date" && repeatKind === "monthly") {
    if (dueDayOffset == null) return null;
    return { behavior_type: behaviorType, repeat_kind: repeatKind, due_day_offset: dueDayOffset };
  }

  // Fixed yearly / one-time: need anchor_date
  if (behaviorType === "fixed_due_date" && repeatKind !== "monthly") {
    if (!anchorDate) return null;
    return { behavior_type: behaviorType, repeat_kind: repeatKind, anchor_date: anchorDate };
  }

  // Prepaid / wallet every_x_*: need interval + anchor_date
  if (["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind)) {
    if (!repeatInterval || !anchorDate) return null;
    return {
      behavior_type:    behaviorType,
      repeat_kind:      repeatKind,
      repeat_interval:  repeatInterval,
      anchor_date:      anchorDate,
    };
  }

  // Prepaid / wallet monthly or yearly: need anchor_date
  if (!anchorDate) return null;
  return { behavior_type: behaviorType, repeat_kind: repeatKind, anchor_date: anchorDate };
}
