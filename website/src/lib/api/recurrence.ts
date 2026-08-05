import { supabase } from "../supabase";

export interface RecurrencePreviewParams {
  behavior_type:       string;
  repeat_kind:         string;
  repeat_interval?:    number | null;
  due_day_offset?:     number | null;
  anchor_date?:        string | null;
  preview_count?:      number;
}

async function fetchRecurrencePreview(
  params: RecurrencePreviewParams
): Promise<string[]> {
  const { data, error } = await supabase.rpc("preview_bill_occurrences", {
    p_behavior_type:       params.behavior_type,
    p_repeat_kind:         params.repeat_kind,
    p_repeat_interval:     params.repeat_interval ?? null,
    p_due_day_offset:      params.due_day_offset ?? null,
    p_validity_days:       null,
    p_check_interval_days: null,
    p_anchor_date:         params.anchor_date ?? null,
    p_preview_from:        (() => {
      if (params.anchor_date) return params.anchor_date;
      const d = new Date();
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    })(),
    p_count:               params.preview_count ?? 5,
  });

  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}

/** Builds preview params; returns null if data is insufficient for a preview. */
export function buildPreviewParams(
  behaviorType:   string | undefined,
  repeatKind:     string | undefined,
  repeatInterval: number | null | undefined,
  dueDayOffset:   number | null | undefined,
  anchorDate:     string | null | undefined,
): RecurrencePreviewParams | null {
  if (!behaviorType || !repeatKind) return null;

  if (behaviorType === "fixed_due_date" && repeatKind === "monthly") {
    if (dueDayOffset == null) return null;
    return { behavior_type: behaviorType, repeat_kind: repeatKind, due_day_offset: dueDayOffset };
  }

  if (behaviorType === "fixed_due_date" && repeatKind !== "monthly") {
    if (!anchorDate) return null;
    return { behavior_type: behaviorType, repeat_kind: repeatKind, anchor_date: anchorDate };
  }

  if (["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind)) {
    if (!repeatInterval || !anchorDate) return null;
    return {
      behavior_type:   behaviorType,
      repeat_kind:     repeatKind,
      repeat_interval: repeatInterval,
      anchor_date:     anchorDate,
    };
  }

  if (!anchorDate) return null;
  return { behavior_type: behaviorType, repeat_kind: repeatKind, anchor_date: anchorDate };
}

export { fetchRecurrencePreview };