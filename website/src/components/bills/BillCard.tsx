import { memo } from "react";
import { CheckCircle2 } from "lucide-react";
import CategoryIconBadge from "./CategoryIconBadge";
import BillStateChip from "./BillStateChip";
import { formatCurrency, formatRelativeDate } from "@shared/utils/format";
import type { Bill, BillOccurrence, OccurrenceState } from "@shared/types";

function getDisplayState(
  state: OccurrenceState,
  dueDate: string | null | undefined
): OccurrenceState {
  if (state === "paid" || state === "archived") return state;
  if (!dueDate) return "upcoming";
  const due = new Date(dueDate + "T00:00:00");
  const now = new Date();
  const dDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((dDay.getTime() - nDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  return "upcoming";
}

interface BillCardProps {
  bill:        Bill;
  occurrence?: BillOccurrence;
  onPress:     () => void;
  onMarkPaid?: (() => void) | null;
}

function BillCardComponent({ bill, occurrence, onPress, onMarkPaid }: BillCardProps) {
  const cat = bill.categories ?? { name: "", icon: "layers", color: "#8B8B8B" };
  const dueDate = occurrence?.due_date ?? occurrence?.expected_payment_date ?? null;
  const displayState = occurrence
    ? getDisplayState(occurrence.state, dueDate)
    : ("upcoming" as OccurrenceState);
  const amount = occurrence?.amount ?? bill.amount_expected ?? null;
  const showMarkPaid = Boolean(onMarkPaid && ["due_today", "overdue", "expected_payment"].includes(displayState));
  const showDateCaption = occurrence && displayState !== "overdue" && displayState !== "due_today";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
        }
      }}
      aria-label={`${bill.title}, ${amount != null ? formatCurrency(amount, bill.currency) : "no amount"}`}
      className="w-full text-left bg-surface border border-border rounded-card mb-3 overflow-hidden shadow-resting hover:border-accent/50 hover:shadow-raised transition-all duration-150 active:scale-[0.99] group cursor-pointer"
    >
      <div className="flex items-center gap-3 p-4">
        <CategoryIconBadge icon={cat.icon} color={cat.color} size={40} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{bill.title}</p>
          {bill.provider_name && (
            <p className="text-xs text-secondary truncate">{bill.provider_name}</p>
          )}
          {occurrence && (
            <div className="mt-1.5">
              <BillStateChip
                state={displayState}
                dueDate={dueDate}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-semibold text-primary font-mono tabular-nums">
            {formatCurrency(amount, bill.currency)}
          </span>
          {showDateCaption && dueDate && (
            <span className="text-[11px] text-secondary">{formatRelativeDate(dueDate)}</span>
          )}
          {showMarkPaid && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkPaid?.();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-success hover:text-success/80 transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              <CheckCircle2 size={13} />
              Mark paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const BillCard = memo(BillCardComponent);
export default BillCard;