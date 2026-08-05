import { View } from "react-native";
import { MonthPicker, getMonthName } from "./MonthPicker";
import { DayPicker, getMaxDayForMonth } from "./DayPicker";
import { YearPicker } from "./YearPicker";

interface DateAnchorPickerProps {
  /** Show month picker. Default true. */
  showMonth?: boolean;
  /** Show day picker. Default true. */
  showDay?: boolean;
  /** Show year picker. Default false (only for one-time). */
  showYear?: boolean;
  month: number | null | undefined;
  day: number | null | undefined;
  year?: number | null | undefined;
  onMonthChange: (m: number) => void;
  onDayChange: (d: number) => void;
  onYearChange?: (y: number) => void;
  errors?: {
    month?: string;
    day?: string;
    year?: string;
  };
  /** Contextual label shown above the pickers. e.g. "Service start", "Due date", "Recharge date" */
  dateLabel?: string;
  /** Order of the pickers. Default is "MDY". */
  order?: "MDY" | "DMY";
  /** Year selection bounds (defaults to YearPicker's full range). */
  yearMin?: number;
  yearMax?: number;
}

export function DateAnchorPicker({
  showMonth = true,
  showDay = true,
  showYear = false,
  month,
  day,
  year,
  onMonthChange,
  onDayChange,
  onYearChange,
  errors,
  dateLabel,
  order = "MDY",
  yearMin,
  yearMax,
}: DateAnchorPickerProps) {
  const maxDay = getMaxDayForMonth(month ?? 0, year ?? undefined);

  // Auto-correct day if it exceeds max for the selected month
  const effectiveDay = day != null && day > maxDay ? null : day;

  const monthLabel = dateLabel ? `${dateLabel} month` : "Month";
  const dayLabel   = dateLabel ? `${dateLabel} day`   : "Day";
  const yearLabel  = dateLabel ? `${dateLabel} year`  : "Year";

  const renderMonth = () => showMonth && (
    <MonthPicker
      key="month"
      value={month}
      label={monthLabel}
      onChange={(m) => {
        onMonthChange(m);
        // If current day exceeds new month's max, clear it
        if (day != null) {
          const newMax = getMaxDayForMonth(m, year ?? undefined);
          if (day > newMax) {
            onDayChange(newMax);
          }
        }
      }}
      error={errors?.month}
    />
  );

  const renderDay = () => showDay && (
    <DayPicker
      key="day"
      value={effectiveDay}
      label={dayLabel}
      onChange={onDayChange}
      maxDay={maxDay}
      error={errors?.day}
    />
  );

  const renderYear = () => showYear && onYearChange && (
    <YearPicker
      key="year"
      value={year}
      label={yearLabel}
      onChange={onYearChange}
      error={errors?.year}
      min={yearMin}
      max={yearMax}
    />
  );

  return (
    <View className="gap-6">
      {order === "DMY" ? (
        <>
          {renderDay()}
          {renderMonth()}
          {renderYear()}
        </>
      ) : (
        <>
          {renderMonth()}
          {renderDay()}
          {renderYear()}
        </>
      )}
    </View>
  );
}

/** Build a YYYY-MM-DD string from components. Returns null if incomplete. */
export function buildAnchorDate(
  month: number | null | undefined,
  day: number | null | undefined,
  yearOverride?: number | null | undefined,
): string | null {
  if (!month || !day) return null;
  const year = yearOverride ?? new Date().getFullYear();
  const maxDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(day, maxDay);
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(clamped).padStart(2, "0"),
  ].join("-");
}

/** Format a YYYY-MM-DD for display. */
export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const monthName = getMonthName(m);
  return `${d} ${monthName} ${y}`;
}

/** Format a date for short display (no year). */
export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const monthName = getMonthName(m);
  return `${d} ${monthName}`;
}
