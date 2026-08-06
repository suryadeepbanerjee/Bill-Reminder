import { Clock, CalendarClock, CalendarDays, AlertTriangle, CheckCircle2, Archive } from "lucide-react";
import type { OccurrenceState } from "@shared/types";
import { formatOverdueLabel } from "@shared/utils/format";

interface BillStateChipProps {
  state:      OccurrenceState;
  label?:     string;
  dueDate?:   string | null;
}

const config: Record<OccurrenceState, { text: string; bg: string; color: string; Icon: typeof Clock }> = {
  upcoming:         { text: "Upcoming",        bg: "bg-neutral-100 dark:bg-neutral-800",  color: "text-neutral-500 dark:text-neutral-400",   Icon: Clock },
  generated:        { text: "Generated",       bg: "bg-sky-50 dark:bg-sky-950",           color: "text-sky-600 dark:text-sky-400",           Icon: Clock },
  expected_payment: { text: "Pay soon",        bg: "bg-sky-50 dark:bg-sky-950",           color: "text-sky-600 dark:text-sky-400",           Icon: CalendarClock },
  due_today:        { text: "Due today",       bg: "bg-amber-50 dark:bg-amber-950",       color: "text-amber-600 dark:text-amber-400",       Icon: AlertTriangle },
  overdue:          { text: "Overdue",         bg: "bg-amber-50 dark:bg-amber-950",       color: "text-amber-700 dark:text-amber-400",       Icon: AlertTriangle },
  paid:             { text: "Paid",            bg: "bg-emerald-50 dark:bg-emerald-950",   color: "text-emerald-600 dark:text-emerald-400",   Icon: CheckCircle2 },
  archived:         { text: "Archived",        bg: "bg-neutral-100 dark:bg-neutral-800",  color: "text-neutral-400",                         Icon: Archive },
};

export default function BillStateChip({ state, label, dueDate }: BillStateChipProps) {
  const c = config[state] ?? config.upcoming;
  const Icon = c.Icon;
  const text =
    label ??
    (state === "overdue" || state === "due_today" ? formatOverdueLabel(dueDate) : c.text);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-pill self-start ${c.bg}`}>
      <Icon size={12} className={c.color} />
      <span className={`text-[11px] font-medium ${c.color}`}>{text}</span>
    </span>
  );
}