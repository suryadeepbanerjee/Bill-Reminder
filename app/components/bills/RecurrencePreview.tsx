import { useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRecurrencePreview, buildPreviewParams } from "../../hooks/useRecurrencePreview";
import { useTapGuard } from "../../hooks/useTapGuard";
import { formatDateDisplay } from "../ui/DateAnchorPicker";

/**
 * Selectable preview row. Own tap-guard so a rapid double-tap can't
 * select a date and immediately clear it (tap-again-to-clear toggle).
 */
function SelectablePreviewRow({
  selected,
  accessibilityLabel,
  onSelect,
  children,
}: {
  selected: boolean;
  accessibilityLabel?: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const guard = useTapGuard(250);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        if (!guard()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      className={`flex-row items-center gap-3 py-1.5 rounded-md px-1 -mx-1 ${
        selected ? "bg-accent/10" : ""
      }`}
    >
      {children}
    </Pressable>
  );
}

function todayString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

interface RecurrencePreviewProps {
  behaviorType: string;
  repeatKind: string;
  repeatInterval?: number | null;
  dueDayOffset?: number | null;
  anchorMonth?: number | null;
  anchorDay?: number | null;
  anchorYear?: number | null;
  /** Override anchor_date string (e.g. from form's buildAnchorDate). */
  anchorDate?: string | null;
  /** Currently selected next-due date (YYYY-MM-DD). */
  value?: string | null;
  /** When provided the rows become tappable; tapping selects, tapping the
   *  selected row again clears it (null = auto). */
  onChange?: (date: string | null) => void;
}

export function RecurrencePreview({
  behaviorType,
  repeatKind,
  repeatInterval,
  dueDayOffset,
  anchorMonth,
  anchorDay,
  anchorYear,
  anchorDate: anchorDateOverride,
  value,
  onChange,
}: RecurrencePreviewProps) {
  // Build anchor_date from components if not overridden
  const anchorDate = anchorDateOverride ?? (() => {
    if (!anchorMonth || !anchorDay) return null;
    const y = anchorYear ?? new Date().getFullYear();
    const maxDay = new Date(y, anchorMonth, 0).getDate();
    const clamped = Math.min(anchorDay, maxDay);
    return `${y}-${String(anchorMonth).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
  })();

  const params = buildPreviewParams(
    behaviorType,
    repeatKind,
    repeatInterval ?? null,
    dueDayOffset ?? null,
    anchorDate,
  );

  const { dates, isLoading, error } = useRecurrencePreview(params);

  const selectable = onChange !== undefined;
  const today = todayString();

  // Chronological list of previewed dates. If the current selection is a
  // pattern cycle beyond the previewed count (e.g. chosen on a previous edit),
  // append it so the "Next" badge can still sit on it.
  const effectiveDates = useMemo(() => {
    if (!dates.length) return dates;
    if (!value || dates.includes(value)) return dates;
    return [...dates, value].sort();
  }, [dates, value]);

  if (!params) return null;

  if (isLoading) {
    return (
      <View className="bg-neutral-50 dark:bg-neutral-900 rounded-card p-4 flex-row items-center gap-3">
        <ActivityIndicator size="small" className="text-secondary" />
        <Text className="text-caption text-secondary">Loading preview…</Text>
      </View>
    );
  }

  if (error || dates.length === 0) return null;

  const defaultNext = effectiveDates.find((d) => d >= today);
  const nextDate = value ?? defaultNext;
  const pastSelected = value != null && value < today;

  return (
    <View className="bg-neutral-50 dark:bg-neutral-900 rounded-card p-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name="calendar-outline" size={14} className="text-secondary" />
        <Text className="text-caption text-secondary font-medium uppercase tracking-wide">
          Next occurrences
        </Text>
      </View>
      <View className="gap-1.5">
        {effectiveDates.map((d) => {
          const isNext = d === nextDate;
          const isPast = d < today;

          const row = (
            <>
              <View
                className={`w-1.5 h-1.5 rounded-full ${
                  isNext ? "bg-accent" : isPast ? "bg-amber-500/70" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              />
              <View className="flex-1">
                <Text
                  className={`text-body ${
                    isNext ? "text-primary font-medium" : "text-secondary"
                  }`}
                >
                  {formatDateDisplay(d)}
                </Text>
                {isPast && (
                  <Text className="text-caption text-amber-600 dark:text-amber-400">
                    {isNext ? "Overdue — bill will show as past due" : "Past"}
                  </Text>
                )}
              </View>
              {isNext && (
                <Text className="text-caption text-accent font-medium ml-auto">
                  Next
                </Text>
              )}
            </>
          );

          if (!selectable) {
            return (
              <View key={d} className="flex-row items-center gap-3 py-1.5">
                {row}
              </View>
            );
          }

          return (
            <SelectablePreviewRow
              key={d}
              selected={d === value}
              accessibilityLabel={`Set next due date to ${formatDateDisplay(d)}`}
              onSelect={() => onChange(d === value ? null : d)}
            >
              {row}
            </SelectablePreviewRow>
          );
        })}
      </View>
      <Text className="text-caption text-secondary leading-4 mt-2">
        {pastSelected
          ? "This date has passed — the bill will appear as overdue until paid."
          : selectable
            ? "Tap a date to set the next due date (tap again to clear)."
            : "Auto-generated from the bill schedule."}
      </Text>
    </View>
  );
}
