import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft, Pencil, Trash2, Bell, Mail, Repeat, CheckCircle2, X,
  Calendar, Clock, Wallet, CalendarDays, Zap,
} from "lucide-react";
import { useBill, useUpdateBill, useDeleteBill } from "../../hooks/useBills";
import { useBillOccurrences } from "../../hooks/useOccurrences";
import { useReminderRules, useToggleReminderRule } from "../../hooks/useReminders";
import { updateBillSchema, type UpdateBillFormData, DUE_DATE_YEAR_MIN, DUE_DATE_YEAR_MAX } from "@shared/schemas/bill";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorView from "../../components/ui/ErrorView";
import Modal from "../../components/ui/Modal";
import Switch from "../../components/ui/Switch";
import Divider from "../../components/ui/Divider";
import AlertBadge from "../../components/ui/AlertBadge";
import NumericInput from "../../components/ui/NumericInput";
import { TextInput } from "../../components/ui/TextInput";
import { Button } from "../../components/ui/Button";
import CategoryIconBadge from "../../components/bills/CategoryIconBadge";
import BillStateChip from "../../components/bills/BillStateChip";
import MarkPaidModal, { type MarkPaidTarget } from "../../components/bills/MarkPaidModal";
import DeleteTransactionModal, { type DeleteTransactionTarget } from "../../components/bills/DeleteTransactionModal";
import RecurrencePreview from "../../components/bills/RecurrencePreview";
import DateAnchorPicker from "../../components/ui/DateAnchorPicker";
import { buildAnchorDate } from "../../components/ui/DateAnchorPicker";
import { useRecurrencePreview } from "../../hooks/useRecurrencePreview";
import { buildPreviewParams } from "../../lib/api/recurrence";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { friendlyError } from "@shared/utils/errors";
import {
  formatCurrency, formatDate, formatRelativeDate, formatOverdueLabel,
  formatBehaviorType, formatRepeatKind, ordinalSuffix,
} from "@shared/utils/format";
import type { BillOccurrence } from "@shared/types";

const ACTIONABLE_STATES = ["due_today", "overdue", "expected_payment", "generated"];

function getReminderAnchorLabel(anchor: string): string {
  switch (anchor) {
    case "due_date":          return "Due date";
    case "expected_payment":  return "Expected payment date";
    default:                  return "Generation date";
  }
}

function getChannelLabel(channel: string): string {
  return channel === "both" ? "Push + Email" : channel;
}

function getChannelIcon(channel: string) {
  if (channel === "push") return Bell;
  if (channel === "email") return Mail;
  return Repeat;
}

function getOffsetLabel(offset: number): string {
  if (offset === 0) return "On the day";
  if (offset < 0) return `${Math.abs(offset)} days before`;
  return `${offset} days after`;
}

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const { data: bill, isLoading, isError, refetch } = useBill(id);
  const { data: occurrences } = useBillOccurrences(id);
  const { data: rules } = useReminderRules(id);
  const deleteBill = useDeleteBill();

  const [showEdit, setShowEdit] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);
  const [deleteTxTarget, setDeleteTxTarget] = useState<DeleteTransactionTarget | null>(null);

  const sortedAsc = useMemo(() => {
    if (!occurrences) return [];
    return [...occurrences].sort((a, b) => a.cycle_start.localeCompare(b.cycle_start));
  }, [occurrences]);

  const currentOccurrence = useMemo(
    () =>
      sortedAsc.find((o) => ACTIONABLE_STATES.includes(o.state)) ??
      sortedAsc[0],
    [sortedAsc]
  );

  const paidOccurrences = useMemo(
    () => (occurrences ?? []).filter((o) => o.state === "paid"),
    [occurrences]
  );

  if (isLoading) {
    return (
      <div>
        <Header title="Bill details" onBack={() => navigate(-1)} />
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <Header title="Bill details" onBack={() => navigate(-1)} />
        <ErrorView message="Failed to load bill." onRetry={refetch} />
      </div>
    );
  }

  if (!bill) {
    // Deep link to a bill that doesn't exist (deleted or bad link).
    return (
      <div>
        <Header title="Bill details" onBack={() => navigate(-1)} />
        <ErrorView message="This bill could not be found. It may have been deleted or the link may be incorrect." />
      </div>
    );
  }

  const cat = bill.categories ?? { id: "", name: "", icon: "layers", color: "#8B8B8B", preset_key: null };
  const displayAmount = currentOccurrence?.amount ?? bill.amount_expected;
  const dueDate = currentOccurrence?.due_date ?? currentOccurrence?.expected_payment_date ?? null;
  const canMarkPaid = currentOccurrence != null && ACTIONABLE_STATES.includes(currentOccurrence.state);
  const isPrepaidOrWallet = ["prepaid_validity", "wallet_balance"].includes(bill.behavior_type);

  const chipLabel =
    currentOccurrence && currentOccurrence.state !== "paid"
      ? currentOccurrence.state === "overdue" || currentOccurrence.state === "due_today"
        ? formatOverdueLabel(dueDate)
        : formatRelativeDate(dueDate)
      : undefined;

  const showDateCaption = !!currentOccurrence;

  const handleDeleteBill = async () => {
    const ok = await confirm({
      title: "Delete bill",
      message: `Are you sure you want to delete "${bill.title}"? All history will be preserved but no new occurrences will be generated.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBill.mutateAsync(bill.id);
      showToast("Bill deleted", "success");
      navigate("/app/bills");
    } catch {
      showToast("Failed to delete bill. Please try again.", "error");
    }
  };

  return (
    <div>
      <Header
        title={bill.title}
        onBack={() => navigate(-1)}
        actions={
          <>
            <button
              type="button"
              aria-label="Edit bill"
              onClick={() => setShowEdit(true)}
              className="p-2 rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
            >
              <Pencil size={17} />
            </button>
            <button
              type="button"
              aria-label="Delete bill"
              onClick={handleDeleteBill}
              className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 size={17} />
            </button>
          </>
        }
      />

      <div className="space-y-6">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center py-6 bg-surface border border-border rounded-card shadow-resting">
          <CategoryIconBadge icon={cat.icon} color={cat.color} size={56} />
          <p className="text-xs text-secondary mt-3">
            {cat.name}{bill.provider_name ? ` · ${bill.provider_name}` : ""}
          </p>
          <h2 className="text-xl font-semibold text-primary mt-1 text-center px-6">{bill.title}</h2>
          <p className="text-3xl font-bold text-primary mt-2 font-mono tabular-nums">
            {displayAmount != null ? formatCurrency(displayAmount, bill.currency) : "Variable"}
          </p>
          {currentOccurrence && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <BillStateChip state={currentOccurrence.state} label={chipLabel} dueDate={dueDate} />
              {showDateCaption && (
                <p className="text-xs text-secondary">{formatDate(dueDate)}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Mark as paid CTA ─────────────────────────────────────────── */}
        {canMarkPaid && currentOccurrence && (
          <button
            type="button"
            onClick={() =>
              setMarkPaidTarget({
                occurrence:     currentOccurrence,
                billTitle:      bill.title,
                amountExpected: bill.amount_expected,
                behaviorType:   bill.behavior_type,
              })
            }
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-input bg-success text-white text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all duration-150"
          >
            <CheckCircle2 size={17} />
            Mark as paid
          </button>
        )}

        {/* ── Details ──────────────────────────────────────────────────── */}
        <section>
          <SectionCaption>Details</SectionCaption>
          <div className="bg-surface border border-border rounded-card divide-y divide-border">
            <DetailRow label="Type" value={formatBehaviorType(bill.behavior_type)} />
            <DetailRow label="Frequency" value={formatRepeatKind(bill.repeat_kind, bill.repeat_interval)} />
            {bill.due_day_offset != null && bill.due_day_offset > 0 && (
              <DetailRow label="Due day" value={`${bill.due_day_offset}${ordinalSuffix(bill.due_day_offset)} of month`} />
            )}
          </div>
        </section>

        {/* ── Reminders ────────────────────────────────────────────────── */}
        <section>
          <SectionCaption>Reminders</SectionCaption>
          {!rules || rules.length === 0 ? (
            <div className="bg-surface border border-border rounded-card py-5 text-center">
              <p className="text-xs text-secondary">No reminders set</p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card divide-y divide-border">
              {rules.map((rule) => (
                <ReminderRuleRow
                  key={rule.id}
                  rule={rule}
                  billId={bill.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Payment history ──────────────────────────────────────────── */}
        {paidOccurrences.length > 0 && (
          <section>
            <SectionCaption>Payment history</SectionCaption>
            <div className="bg-surface border border-border rounded-card divide-y divide-border">
              {paidOccurrences.slice(0, 12).map((o, idx, arr) => (
                <OccurrenceRow
                  key={o.id}
                  occurrence={o}
                  isOldest={idx === arr.length - 1}
                  hasOlder={idx < arr.length - 1}
                  previousCycleStart={arr[idx + 1]?.cycle_start ?? null}
                  onDelete={() => setDeleteTxTarget({
                    occurrence: o,
                    bill,
                    isOldest: idx === arr.length - 1,
                    hasOlder: idx < arr.length - 1,
                    previousCycleStart: arr[idx + 1]?.cycle_start ?? null,
                  })}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() => showToast(`${bill.title} marked as paid`, "success")}
      />

      <DeleteTransactionModal
        target={deleteTxTarget}
        onClose={() => setDeleteTxTarget(null)}
        onSuccess={() => showToast("Payment deleted", "success")}
      />

      {showEdit && (
        <EditBillSheet
          bill={bill}
          onClose={() => setShowEdit(false)}
          onSuccess={() => showToast("Bill updated", "success")}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({
  title, onBack, actions,
}: {
  title: string;
  onBack: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-primary tracking-tight truncate max-w-[180px] sm:max-w-[400px]">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}

function SectionCaption({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary mb-3 px-0.5">
      {children}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}

function ReminderRuleRow({ rule, billId }: { rule: any; billId: string }) {
  const toggle = useToggleReminderRule();
  const Icon = getChannelIcon(rule.channel);
  // Push delivery and "both" reminders run through the mobile app only — no
  // notification permission exists on web, so they render read-only here.
  const isPush = rule.channel === "push" || rule.channel === "both";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-secondary shrink-0">
        <Icon size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">{getOffsetLabel(rule.offset_days)}</p>
        <p className="text-xs text-secondary">
          {getReminderAnchorLabel(rule.anchor)} · {getChannelLabel(rule.channel)}
        </p>
      </div>
      {isPush ? (
        <span className="text-[11px] text-secondary font-medium shrink-0">
          In the mobile app
        </span>
      ) : (
        <Switch
          checked={rule.enabled}
          disabled={toggle.isPending}
          onChange={(enabled) => toggle.mutate({ id: rule.id, enabled, billId })}
          label={`${getOffsetLabel(rule.offset_days)} reminder ${rule.enabled ? "on" : "off"}`}
        />
      )}
    </div>
  );
}

function OccurrenceRow({
  occurrence, isOldest, hasOlder, previousCycleStart, onDelete,
}: {
  occurrence: BillOccurrence;
  isOldest: boolean;
  hasOlder: boolean;
  previousCycleStart: string | null;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">{formatDate(occurrence.cycle_start)}</p>
        {occurrence.paid_at && (
          <p className="text-xs text-secondary truncate">
            Paid {formatDate(occurrence.paid_at)}
            {occurrence.payment_notes ? ` · ${occurrence.payment_notes}` : ""}
          </p>
        )}
      </div>
      {occurrence.paid_amount != null && (
        <span className="text-sm font-semibold text-primary font-mono tabular-nums shrink-0">
          {formatCurrency(occurrence.paid_amount)}
        </span>
      )}
      <BillStateChip state={occurrence.state} />
      <button
        type="button"
        aria-label="Delete transaction"
        onClick={onDelete}
        className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors shrink-0"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Edit bill sheet ───────────────────────────────────────────────────────────

const EDIT_BEHAVIOR_OPTIONS = [
  { value: "fixed_due_date",  label: "Fixed due date",   icon: Calendar },
  { value: "prepaid_validity",label: "Prepaid / Validity", icon: Clock },
  { value: "wallet_balance",  label: "Wallet / Balance", icon: Wallet },
];

const EDIT_REPEAT_OPTIONS = [
  { value: "monthly",        label: "Every month",       needsInterval: false },
  { value: "yearly",         label: "Every year",        needsInterval: false },
  { value: "none",           label: "One-time (no repeat)", needsInterval: false },
  { value: "every_x_days",   label: "Every X days",      needsInterval: true },
  { value: "every_x_weeks",  label: "Every X weeks",     needsInterval: true },
  { value: "every_x_months", label: "Every X months",    needsInterval: true },
];

function EditBillSheet({
  bill, onClose, onSuccess,
}: {
  bill: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const updateBill = useUpdateBill();
  const [error, setError] = useState<string | null>(null);
  const [nextDueDate, setNextDueDate] = useState<string | null>(bill.next_due_date ?? null);

  const initialAnchor = useMemo(() => {
    const src = bill.anchor_date
      ? new Date(bill.anchor_date + "T00:00:00")
      : new Date(bill.created_at);
    return { month: src.getMonth() + 1, day: src.getDate(), year: src.getFullYear() };
  }, [bill.anchor_date, bill.created_at]);

  const form = useForm<UpdateBillFormData>({
    resolver: zodResolver(updateBillSchema) as unknown as Resolver<UpdateBillFormData, any>,
    mode:     "onBlur",
    defaultValues: {
      title:           bill.title,
      provider_name:   bill.provider_name ?? undefined,
      amount_expected: bill.amount_expected ?? undefined,
      behavior_type:   bill.behavior_type,
      repeat_kind:     bill.repeat_kind,
      repeat_interval: bill.repeat_interval ?? undefined,
      due_day_offset:  bill.due_day_offset ?? undefined,
      anchor_month:    initialAnchor.month,
      anchor_day:      initialAnchor.day,
      anchor_year:     initialAnchor.year,
    },
  });

  const { watch, setValue, handleSubmit, formState: { errors } } = form;

  const behaviorType = watch("behavior_type");
  const repeatKind   = watch("repeat_kind");
  const repeatInterval = watch("repeat_interval");
  const dueDayOffset   = watch("due_day_offset");
  const anchorMonth    = watch("anchor_month") ?? initialAnchor.month;
  const anchorDay      = watch("anchor_day") ?? initialAnchor.day;
  const anchorYear     = watch("anchor_year") ?? initialAnchor.year;

  const isPrepaidOrWallet = behaviorType === "prepaid_validity" || behaviorType === "wallet_balance";
  const showEveryX = isPrepaidOrWallet;

  const anchorDate = useMemo(
    () => buildAnchorDate(anchorMonth, anchorDay, anchorYear),
    [anchorMonth, anchorDay, anchorYear]
  );

  const previewParams = useMemo(
    () => buildPreviewParams(behaviorType, repeatKind, repeatInterval, dueDayOffset, anchorDate),
    [behaviorType, repeatKind, repeatInterval, dueDayOffset, anchorDate]
  );
  const { dates: previewDates, isLoading: previewLoading } = useRecurrencePreview(previewParams);

  const handleSave = async (data: UpdateBillFormData) => {
    setError(null);
    try {
      const anchor_date = buildAnchorDate(data.anchor_month, data.anchor_day, data.anchor_year);
      const payload = {
        ...data,
        anchor_date:                anchor_date || null,
        next_due_date:              nextDueDate,
        due_day_offset:             data.behavior_type === "fixed_due_date" ? (data.due_day_offset ?? null) : null,
        generation_day_offset:      null,
        expected_payment_day_offset: null,
      };
      const { anchor_month: _am, anchor_day: _ad, anchor_year: _ay, ...dbPayload } = payload as any;
      await updateBill.mutateAsync({ id: bill.id, input: dbPayload });
      onSuccess();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const anchorValue = { month: anchorMonth, day: anchorDay, year: anchorYear };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit bill"
      size="lg"
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            fullWidth
            loading={updateBill.isPending}
            onClick={handleSubmit(handleSave, () => setError("Please fill all required fields correctly."))}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        {error && <AlertBadge variant="error">{error}</AlertBadge>}

        <TextInput
          label="Bill name"
          maxCharacters={120}
          value={watch("title") ?? ""}
          onChange={(e) => setValue("title", e.target.value, { shouldValidate: true })}
          error={errors.title?.message}
        />

        <TextInput
          label="Provider / Vendor"
          maxCharacters={80}
          value={watch("provider_name") ?? ""}
          onChange={(e) => setValue("provider_name", e.target.value, { shouldValidate: true })}
          error={errors.provider_name?.message}
        />

        <NumericInput
          label="Expected amount"
          prefix="₹"
          value={typeof watch("amount_expected") === "number" ? watch("amount_expected") : undefined}
          onChange={(v) => setValue("amount_expected", v as any, { shouldValidate: true })}
          hint="Leave blank if it varies each cycle"
          error={errors.amount_expected?.message as string | undefined}
        />

        {/* Bill type */}
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">Bill type</p>
          <div className="space-y-2">
            {EDIT_BEHAVIOR_OPTIONS.map((opt) => {
              const selected = behaviorType === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue("behavior_type", opt.value as any, { shouldValidate: true })}
                  className={`w-full flex items-center gap-3 p-3 rounded-card border text-left transition-all duration-150 ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-accent/20 text-accent" : "bg-input text-secondary"}`}>
                    <Icon size={15} />
                  </span>
                  <span className="text-sm flex-1 font-medium text-primary">{opt.label}</span>
                  {selected && <CheckCircle2 size={16} className="text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Repeat frequency */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">Repeat frequency</p>
          <div className="space-y-1.5">
            {EDIT_REPEAT_OPTIONS.filter((o) => !o.needsInterval || showEveryX).map((opt) => {
              const selected = repeatKind === opt.value;
              const Icon = opt.needsInterval ? Repeat : CalendarDays;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue("repeat_kind", opt.value as any, { shouldValidate: true })}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-input border transition-all duration-150 ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <Icon size={15} className={selected ? "text-accent" : "text-secondary"} />
                  <span className={`text-sm flex-1 text-left ${selected ? "font-semibold text-primary" : "text-secondary"}`}>
                    {opt.label}
                  </span>
                  {selected && <CheckCircle2 size={15} className="text-accent" />}
                </button>
              );
            })}
          </div>
        </div>

        {["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind ?? "") && (
          <NumericInput
            label={`Every how many ${repeatKind === "every_x_days" ? "days" : repeatKind === "every_x_weeks" ? "weeks" : "months"}?`}
            integer
            value={repeatInterval}
            onChange={(v) => setValue("repeat_interval", v as any, { shouldValidate: true })}
            placeholder="e.g. 2"
            error={errors.repeat_interval?.message}
          />
        )}

        {behaviorType === "fixed_due_date" && repeatKind === "monthly" && (
          <NumericInput
            label="Due on day (of month)"
            integer
            value={dueDayOffset}
            onChange={(v) => setValue("due_day_offset", v as any, { shouldValidate: true })}
            placeholder="e.g. 5"
            hint="Enter 0 for end-of-cycle (last day)"
            error={errors.due_day_offset?.message}
          />
        )}

        {behaviorType === "fixed_due_date" && repeatKind === "yearly" && (
          <DateAnchorPicker
            label="Due date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
            }}
            showMonth
            showDay

          />
        )}

        {behaviorType === "fixed_due_date" && repeatKind === "none" && (
          <DateAnchorPicker
            label="Due date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
              setValue("anchor_year", v.year, { shouldValidate: true });
            }}
            showMonth
            showDay
            showYear
            order="DMY"
            yearMin={DUE_DATE_YEAR_MIN}
            yearMax={DUE_DATE_YEAR_MAX}

          />
        )}

        {isPrepaidOrWallet && (repeatKind === "monthly" || repeatKind === "yearly") && (
          <DateAnchorPicker
            label="Last payment date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
            }}
            showMonth
            showDay

          />
        )}

        {isPrepaidOrWallet && (repeatKind === "every_x_days" || repeatKind === "every_x_weeks") && (
          <DateAnchorPicker
            label="Last payment date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
              setValue("anchor_year", v.year, { shouldValidate: true });
            }}
            showMonth
            showDay
            showYear

          />
        )}

        {isPrepaidOrWallet && repeatKind === "every_x_months" && (
          <DateAnchorPicker
            label="Last payment date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
            }}
            showMonth
            showDay

          />
        )}

        {isPrepaidOrWallet && repeatKind === "none" && (
          <DateAnchorPicker
            label="Due date"
            value={anchorValue}
            onChange={(v) => {
              setValue("anchor_month", v.month, { shouldValidate: true });
              setValue("anchor_day", v.day, { shouldValidate: true });
              setValue("anchor_year", v.year, { shouldValidate: true });
            }}
            showMonth
            showDay
            showYear
            order="DMY"
            yearMin={DUE_DATE_YEAR_MIN}
            yearMax={DUE_DATE_YEAR_MAX}

          />
        )}

        {isPrepaidOrWallet && (
          <div className="mt-2">
            <RecurrencePreview
              dates={previewDates}
              isLoading={previewLoading}
              value={nextDueDate}
              onChange={setNextDueDate}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
