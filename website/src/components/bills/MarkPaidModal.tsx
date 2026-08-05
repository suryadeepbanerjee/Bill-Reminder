import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import NumericInput from "../ui/NumericInput";
import Switch from "../ui/Switch";
import AlertBadge from "../ui/AlertBadge";
import DateAnchorPicker from "../ui/DateAnchorPicker";
import { useMarkPaid } from "../../hooks/useOccurrences";
import { todayIso } from "../ui/DateAnchorPicker";
import type { BillOccurrence } from "../../lib/types";

export interface MarkPaidTarget {
  occurrence:     BillOccurrence;
  billTitle:      string;
  amountExpected: number | null;
  behaviorType:   string;
}

interface MarkPaidModalProps {
  target:    MarkPaidTarget | null;
  onClose:   () => void;
  onSuccess: () => void;
}

function parseAnchor(value: string | null): { month: number | null; day: number | null; year: number | null } {
  if (!value) return { month: null, day: null, year: null };
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export default function MarkPaidModal({ target, onClose, onSuccess }: MarkPaidModalProps) {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [paidToday, setPaidToday] = useState(true);
  const [date, setDate] = useState<{ month: number | null; day: number | null; year: number | null }>({ month: null, day: null, year: null });
  const [shiftAnchor, setShiftAnchor] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const markPaid = useMarkPaid();

  useEffect(() => {
    if (!target) return;
    setAmount(target.occurrence.amount ?? target.amountExpected ?? undefined);
    setPaidToday(true);
    setShiftAnchor(false);
    setNotes("");
    setError(null);
    setDate({ month: null, day: null, year: null });
  }, [target]);

  const canShiftAnchor = useMemo(
    () => target != null && ["prepaid_validity", "wallet_balance"].includes(target.behaviorType),
    [target]
  );

  const isVariable =
    target != null && target.amountExpected == null && target.occurrence.amount == null;

  const handleConfirm = async () => {
    if (!target) return;
    setError(null);

    const parsed = Number(amount);
    if (amount === undefined || Number.isNaN(parsed) || parsed < 0) {
      setError("Please enter a valid amount.");
      return;
    }

    let paidAtIso: string;
    if (paidToday) {
      paidAtIso = new Date().toISOString();
    } else {
      const { month, day, year } = date;
      if (!month || !day || !year) {
        setError("Please select the date you paid.");
        return;
      }
      paidAtIso = new Date(year, month - 1, day, 12, 0, 0).toISOString();
    }

    try {
      await markPaid.mutateAsync({
        occurrence_id:            target.occurrence.id,
        paid_amount:              parsed,
        paid_at:                  paidAtIso,
        payment_notes:            notes.trim() || null,
        shift_anchor_to_payment:  shiftAnchor,
      });
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Mark as paid"
      subtitle={
        target && (
          <span>
            {target.billTitle}
            {isVariable && <span> · Variable amount</span>}
          </span>
        )
      }
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            fullWidth
            loading={markPaid.isPending}
            onClick={handleConfirm}
          >
            Confirm payment
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {error && <AlertBadge variant="error">{error}</AlertBadge>}

        <NumericInput
          label={isVariable ? "Amount paid *" : "Amount paid"}
          prefix="₹"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(null);
          }}
          placeholder="0"
          hint={
            isVariable
              ? "Required — enter the exact amount charged this cycle"
              : "Pre-filled with the expected amount"
          }
        />

        {/* Paid today? */}
        <div className="flex items-center justify-between py-3">
          <span className="text-sm font-medium text-primary">Paid today?</span>
          <Switch
            checked={paidToday}
            onChange={(v) => {
              setPaidToday(v);
              if (v) setDate({ month: null, day: null, year: null });
            }}
            label="Paid today?"
          />
        </div>

        {!paidToday && (
          <DateAnchorPicker
            label="Payment date"
            value={date}
            onChange={setDate}
            showMonth
            showDay
            showYear
          />
        )}

        {/* Shift anchor — prepaid / wallet only */}
        {canShiftAnchor && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
              Calculate next due date from:
            </p>
            <div className="bg-input/60 border border-border rounded-card overflow-hidden divide-y divide-border">
              <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                <Radio checked={!shiftAnchor} onChange={() => setShiftAnchor(false)} />
                <div>
                  <p className="text-sm font-medium text-primary">Original due date</p>
                  <p className="text-xs text-secondary">Keeps the original billing cycle</p>
                </div>
              </label>
              <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                <Radio checked={shiftAnchor} onChange={() => setShiftAnchor(true)} />
                <div>
                  <p className="text-sm font-medium text-primary">Date of payment</p>
                  <p className="text-xs text-secondary">Shifts the cycle to start from payment</p>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="pt-2">
          <label className="block text-sm font-medium text-primary mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Payment reference, transaction ID…"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-input bg-input border border-border text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:bg-surface transition-colors resize-none"
          />
          <p className="text-right text-xs text-secondary mt-1">
            {notes.length}/{1000}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Radio({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center shrink-0 mt-0.5"
      onClick={(e) => {
        e.preventDefault();
        onChange();
      }}
      role="radio"
      aria-checked={checked}
    >
      {checked && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
    </span>
  );
}

export const PAID_TODAY_NOW = todayIso;