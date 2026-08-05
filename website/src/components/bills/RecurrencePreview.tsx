import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { formatDateDisplay, todayIso } from "../ui/DateAnchorPicker";

interface RecurrencePreviewProps {
  dates:     string[];
  isLoading: boolean;
  value?:    string | null;      // selected next_due_date
  onChange?: (value: string) => void; // make rows tappable; omit for read-only
  label?:    string;
}

/** True when the date string represents a date before today */
export function isPastDate(d: string): boolean {
  return d < todayIso();
}

export default function RecurrencePreview({ dates, isLoading, value, onChange, label = "NEXT OCCURRENCES" }: RecurrencePreviewProps) {
  const selectable = Boolean(onChange);

  // When a chosen date exists beyond the fetched 5, append it so the badge survives.
  const effectiveDates = useMemo(() => {
    if (value && !dates.includes(value)) return [...dates, value].sort();
    return dates;
  }, [dates, value]);

  const today = todayIso();
  const nextDate = value ?? effectiveDates.find((d) => d >= today);

  const footerHint = (() => {
    if (!selectable) return "Auto-generated from the bill schedule.";
    if (value && isPastDate(value)) {
      return "This date has passed — the bill will appear as overdue until paid.";
    }
    return "Tap a date to set the next due date (tap again to clear).";
  })();

  return (
    <div className="bg-input/60 border border-border rounded-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">{label}</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-secondary py-3">Loading preview…</p>
      ) : (
        <div className="divide-y divide-border">
          {effectiveDates.map((d) => {
            const isNext = d === nextDate;
            const past = isPastDate(d);
            const dotClass = isNext ? "bg-accent" : past ? "bg-amber-500/70" : "bg-neutral-400/60";
            return (
              <div
                key={d}
                role={selectable ? "button" : undefined}
                tabIndex={selectable ? 0 : undefined}
                onClick={selectable ? () => onChange!(d) : undefined}
                onKeyDown={selectable ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange!(d); }
                } : undefined}
                className={`flex items-center gap-3 py-2.5 px-1 rounded-md ${
                  selectable && value === d ? "bg-accent/10" : ""
                } ${selectable ? "cursor-pointer hover:bg-input/60 transition-colors" : ""}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                <span className={`text-sm flex-1 ${past ? "text-secondary" : "text-primary"}`}>
                  {formatDateDisplay(d)}
                </span>
                {isNext && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Next</span>
                )}
                {(past && nextDate === d) ? (
                  <span className="text-[11px] text-warning">Overdue — bill will show as past due</span>
                ) : past ? (
                  <span className="text-[11px] text-neutral-400">Past</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-secondary mt-3">{footerHint}</p>
    </div>
  );
}