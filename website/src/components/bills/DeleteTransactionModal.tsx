import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import AlertBadge from "../ui/AlertBadge";
import DateAnchorPicker from "../ui/DateAnchorPicker";
import { useDeleteTransaction } from "../../hooks/useOccurrences";
import type { Bill, BillOccurrence } from "@shared/types";

export interface DeleteTransactionTarget {
  occurrence:        BillOccurrence;
  bill:              Bill;
  isOldest:          boolean;
  hasOlder:          boolean;
  previousCycleStart?: string | null;
}

interface DeleteTransactionModalProps {
  target:    DeleteTransactionTarget | null;
  onClose:   () => void;
  onSuccess: () => void;
}

function formatDateUS(date: string): string {
  const d = new Date(date + (date.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function ymd(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseYmd(value: string): { month: number | null; day: number | null; year: number | null } {
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

type AnchorAction = "keep" | "revert" | "custom";

export default function DeleteTransactionModal({ target, onClose, onSuccess }: DeleteTransactionModalProps) {
  const [anchorAction, setAnchorAction] = useState<AnchorAction>("keep");
  const [custom, setCustom] = useState<{ month: number | null; day: number | null; year: number | null }>({ month: null, day: null, year: null });
  const [error, setError] = useState<string | null>(null);

  const deleteTx = useDeleteTransaction();

  useEffect(() => {
    if (!target) return;
    setAnchorAction("keep");
    setCustom({ month: null, day: null, year: null });
    setError(null);
  }, [target]);

  if (!target) return null;

  const isPrepaidOrWallet = ["prepaid_validity", "wallet_balance"].includes(target.bill.behavior_type);
  const currentAnchorDate = target.bill.anchor_date ?? target.occurrence.cycle_start;

  const handleDelete = async () => {
    setError(null);

    let customAnchor: string | null = null;

    if (isPrepaidOrWallet && anchorAction === "custom") {
      const { month, day, year } = custom;
      if (!month || !day || !year) {
        setError("Please select a valid date.");
        return;
      }
      const date = new Date(year, month - 1, day, 12, 0, 0);
      const created = new Date(target.bill.created_at);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (date.getTime() < created.getTime()) {
        setError("Date cannot be before the bill was created.");
        return;
      }
      if (date.getTime() > todayEnd.getTime()) {
        setError("Date cannot be in the future.");
        return;
      }
      customAnchor = ymd(date);
    }

    try {
      await deleteTx.mutateAsync({
        occurrence_id: target.occurrence.id,
        anchor_action: isPrepaidOrWallet ? anchorAction : "keep",
        custom_anchor: customAnchor,
      });
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong.");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete payment?"
      subtitle={`${target.bill.title} · ${formatDateUS(target.occurrence.cycle_start)}`}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            fullWidth
            loading={deleteTx.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AlertBadge variant="warning">
          <span className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            This payment record will be removed from your history.
          </span>
        </AlertBadge>

        {isPrepaidOrWallet ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
              How should the billing cycle be adjusted?
            </p>
            <div className="bg-input/60 border border-border rounded-card overflow-hidden divide-y divide-border">
              <AnchorOption
                checked={anchorAction === "keep"}
                onSelect={() => setAnchorAction("keep")}
                title="Keep current schedule"
                caption={
                  currentAnchorDate
                    ? `Stay on ${formatDateUS(currentAnchorDate)}`
                    : "Keep the existing billing cycle"
                }
              />
              {target.hasOlder && target.previousCycleStart && (
                <AnchorOption
                  checked={anchorAction === "revert"}
                  onSelect={() => setAnchorAction("revert")}
                  title="Revert to previous date"
                  caption={`Reset to ${formatDateUS(target.previousCycleStart)}`}
                />
              )}
              <AnchorOption
                checked={anchorAction === "custom"}
                onSelect={() => setAnchorAction("custom")}
                title="Choose a different date"
                caption="Manually pick a start date"
              />
            </div>

            {anchorAction === "custom" && (
              <div className="mt-4">
                <DateAnchorPicker
                  label="New start date"
                  value={custom}
                  onChange={setCustom}
                  showMonth
                  showDay
                  showYear
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-secondary leading-relaxed">
            This is a fixed-date bill. Only this payment record will be removed; the billing schedule stays the same.
          </p>
        )}

        {error && <AlertBadge variant="error">{error}</AlertBadge>}
      </div>
    </Modal>
  );
}

function AnchorOption({
  checked,
  onSelect,
  title,
  caption,
}: {
  checked:  boolean;
  onSelect: () => void;
  title:    string;
  caption:  string;
}) {
  return (
    <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
      <span
        className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center shrink-0 mt-0.5"
        role="radio"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
      </span>
      <div>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="text-xs text-secondary">{caption}</p>
      </div>
    </label>
  );
}