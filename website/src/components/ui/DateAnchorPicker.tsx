import { useEffect, useMemo } from "react";

// ── Shared date helpers ───────────────────────────────────────────────────────

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function getMaxDayForMonth(month: number, year?: number | null): number {
  if (year) return new Date(year, month, 0).getDate();
  return new Date(2024, month, 0).getDate(); // leap year — never cuts off Feb 29
}

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

export function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Format an ISO date (`YYYY-MM-DD`) for compact display, e.g. `5 Jan 2026`. */
export function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

// ── MonthPicker ───────────────────────────────────────────────────────────────

export function MonthPicker({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (month: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MONTH_SHORT.map((m, i) => {
        const selected = value === i + 1;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(i + 1)}
            aria-pressed={selected}
            className={`h-10 rounded-input text-[13px] font-medium transition-all duration-150 border ${
              selected
                ? "bg-accent text-accent-text border-accent"
                : "bg-input text-secondary border-border hover:border-accent/50 hover:text-primary"
            }`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

// ── DayPicker ─────────────────────────────────────────────────────────────────

export function DayPicker({
  value,
  month,
  year,
  onChange,
}: {
  value: number | null | undefined;
  month: number | null | undefined;
  year?: number | null;
  onChange: (day: number) => void;
}) {
  const maxDay = useMemo(() => getMaxDayForMonth(month ?? 1, year), [month, year]);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const selected = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={selected}
            className={`aspect-square h-11 max-h-11 w-full rounded-lg text-[13px] font-medium tabular-nums transition-all duration-150 border ${
              selected
                ? "bg-accent text-accent-text border-accent"
                : "bg-input text-primary border-border hover:border-accent/50"
            }`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// ── YearPicker ────────────────────────────────────────────────────────────────

export function YearPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number | null | undefined;
  min: number;
  max: number;
  onChange: (year: number) => void;
}) {
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="grid grid-cols-5 gap-2">
      {years.map((y) => {
        const selected = value === y;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            aria-pressed={selected}
            className={`h-10 rounded-input text-[13px] font-medium tabular-nums transition-all duration-150 border ${
              selected
                ? "bg-accent text-accent-text border-accent"
                : "bg-input text-secondary border-border hover:border-accent/50 hover:text-primary"
            }`}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

// ── DateAnchorPicker (composite) ──────────────────────────────────────────────

export interface DateAnchorValue {
  month: number | null;
  day:   number | null;
  year:  number | null;
}

export interface DateAnchorPickerProps {
  label:      string;
  value:      DateAnchorValue;
  onChange:   (v: DateAnchorValue) => void;
  showMonth?: boolean;
  showDay?:   boolean;
  showYear?:  boolean;
  order?:     "MDY" | "DMY";
  yearMin?:   number;
  yearMax?:   number;
}

export default function DateAnchorPicker({
  label,
  value,
  onChange,
  showMonth = true,
  showDay = true,
  showYear = false,
  order = "MDY",
  yearMin,
  yearMax,
}: DateAnchorPickerProps) {
  const { month, day, year } = value;

  // Clamp day when month changes
  useEffect(() => {
    if (day != null && month != null) {
      const newMax = getMaxDayForMonth(month, year);
      if (day > newMax) onChange({ ...value, day: newMax });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const months = showMonth && (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
        {label} month
      </p>
      <MonthPicker
        value={month}
        onChange={(m) => {
          let next = { ...value, month: m };
          if (day != null) {
            const newMax = getMaxDayForMonth(m, year);
            if (day > newMax) next = { ...next, day: newMax };
          }
          onChange(next);
        }}
      />
    </div>
  );

  const days = showDay && (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
        {label} day
      </p>
      <DayPicker
        value={day}
        month={month}
        year={year}
        onChange={(d) => onChange({ ...value, day: d })}
      />
    </div>
  );

  const years = showYear && (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
        {label} year
      </p>
      <YearPicker
        value={year}
        min={yearMin ?? new Date().getFullYear()}
        max={yearMax ?? new Date().getFullYear() + 10}
        onChange={(y) => onChange({ ...value, year: y })}
      />
    </div>
  );

  return (
    <div className="mb-4">
      {order === "DMY" ? (
        <>
          {days}{months}{years}
        </>
      ) : (
        <>
          {months}{days}{years}
        </>
      )}
    </div>
  );
}