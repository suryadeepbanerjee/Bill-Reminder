import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar, Clock, Wallet, Repeat, Zap, X, Check, ChevronLeft,
  CalendarClock, CalendarDays, BellRing,
} from "lucide-react";
import { createBillSchema, type CreateBillFormData, DUE_DATE_YEAR_MIN, DUE_DATE_YEAR_MAX } from "@shared/schemas/bill";
import { useCategoryPresets } from "../../hooks/useCategories";
import { useHousehold } from "../../hooks/useHousehold";
import { useAuthStore } from "../../stores/auth-store";
import { useCreateBill } from "../../hooks/useBills";
import { useRecurrencePreview } from "../../hooks/useRecurrencePreview";
import { buildPreviewParams } from "../../lib/api/recurrence";
import { createReminderRule, defaultReminderRules } from "../../lib/api/reminders";
import { ensureHouseholdCategoryFromPreset } from "../../lib/api/categories";
import { buildAnchorDate, DateAnchorValue } from "../../components/ui/DateAnchorPicker";
import DateAnchorPicker from "../../components/ui/DateAnchorPicker";
import NumericInput from "../../components/ui/NumericInput";
import { TextInput } from "../../components/ui/TextInput";
import { Button } from "../../components/ui/Button";
import AlertBadge from "../../components/ui/AlertBadge";
import CategoryIconBadge from "../../components/bills/CategoryIconBadge";
import RecurrencePreview from "../../components/bills/RecurrencePreview";
import { friendlyError } from "@shared/utils/errors";
import { useToast } from "../../components/ui/Toast";

// ── Per-category placeholders ───────────────────────────────────────────────

const NAME_PLACEHOLDER_BY_KEY: Record<string, string> = {
  credit_card:     "e.g. HDFC Credit Card",
  mobile_recharge: "e.g. Airtel Prepaid",
  broadband:       "e.g. Home WiFi",
  electricity:     "e.g. Electricity",
  water:           "e.g. Water Bill",
  gas:             "e.g. LPG Cylinder",
  insurance:       "e.g. Health Insurance",
  emi:             "e.g. Bike EMI",
  rent:            "e.g. House Rent",
  loan:            "e.g. Personal Loan",
  ott:             "e.g. Netflix",
  music:           "e.g. Spotify",
  cloud_services:  "e.g. iCloud Storage",
  hosting:         "e.g. Website Hosting",
  domain:          "e.g. Domain Renewal",
  education:       "e.g. Tuition Fees",
  gym:             "e.g. Gym Membership",
  health:          "e.g. Health Checkup",
  investments:     "e.g. SIP Investment",
  subscriptions:   "e.g. Amazon Prime",
  other:           "e.g. Bill name",
};

const PROVIDER_PLACEHOLDER_BY_KEY: Record<string, string> = {
  credit_card:     "e.g. HDFC Bank",
  mobile_recharge: "e.g. Airtel",
  broadband:       "e.g. ACT Fibernet",
  electricity:     "e.g. State Electricity Board",
  water:           "e.g. Municipal Water Board",
  gas:             "e.g. Indane",
  insurance:       "e.g. LIC",
  emi:             "e.g. Bajaj Finserv",
  rent:            "e.g. Landlord name",
  loan:            "e.g. HDFC Bank",
  ott:             "e.g. Netflix",
  music:           "e.g. Spotify",
  cloud_services:  "e.g. Apple",
  hosting:         "e.g. Hostinger",
  domain:          "e.g. GoDaddy",
  education:       "e.g. School / Institute name",
  gym:             "e.g. Cult.fit",
  health:          "e.g. Apollo Pharmacy",
  investments:     "e.g. Zerodha",
  subscriptions:   "e.g. Amazon",
  other:           "e.g. Reliance Jio",
};

const DEFAULT_NAME_PLACEHOLDER     = "e.g. Electricity, Netflix";
const DEFAULT_PROVIDER_PLACEHOLDER = "e.g. Reliance Jio";

const BEHAVIOR_OPTIONS = [
  { value: "fixed_due_date", label: "Fixed due date",   icon: Calendar,   description: "Due on a specific day each cycle — electricity, rent, EMI, etc." },
  { value: "prepaid_validity", label: "Prepaid / Recharge", icon: Clock,  description: "Pay upfront — mobile recharge, OTT, annual plans, etc." },
  { value: "wallet_balance", label: "Wallet / Balance", icon: Wallet,     description: "Balance-based — check periodically and top up when low." },
];

function getRepeatOptions(bt: string) {
  if (bt === "fixed_due_date") {
    return [
      { value: "monthly", label: "Monthly",   icon: CalendarDays },
      { value: "yearly",  label: "Yearly",    icon: CalendarDays },
      { value: "none",    label: "One-time",  icon: Zap },
    ];
  }
  return [
    { value: "monthly",        label: "Monthly",          icon: CalendarDays },
    { value: "yearly",         label: "Yearly",           icon: CalendarDays },
    { value: "every_x_days",   label: "Every X days",     icon: Repeat },
    { value: "every_x_weeks",  label: "Every X weeks",    icon: Repeat },
    { value: "every_x_months", label: "Every X months",   icon: Repeat },
    { value: "none",           label: "One-time",         icon: Zap },
  ];
}

function getStep3Title(bt: string): string {
  if (bt === "wallet_balance") return "How often to check wallet?";
  return "When is this bill due?";
}

function getStep3Subtitle(bt: string): string {
  if (bt === "wallet_balance") return "Set the schedule for balance checks.";
  if (bt === "prepaid_validity") return "Set when this prepaid cycle starts and repeats.";
  return "We'll use this to predict when the next bill is due.";
}

const PRESET_ORDER = [
  "broadband", "rent", "credit_card", "domain", "education",
  "electricity", "emi", "gas", "gym", "health", "hosting",
  "insurance", "investments", "loan", "subscriptions", "music",
  "water", "ott", "mobile_recharge", "cloud_services", "other",
];

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Category",
  2: "Details",
  3: "Schedule",
};

export default function AddBillPage() {
  const navigate = useNavigate();
  const { activeHousehold } = useHousehold();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const { data: presets, isLoading: presetsLoading } = useCategoryPresets();
  const createBill = useCreateBill();

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [nextDueDate, setNextDueDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateBillFormData>({
    resolver: zodResolver(createBillSchema) as unknown as Resolver<CreateBillFormData, any>,
    mode:     "onBlur",
    defaultValues: {
      household_id:   activeHousehold?.household.id ?? "",
      behavior_type:  "fixed_due_date",
      repeat_kind:    "monthly",
      currency:       "INR",
    },
  });

  const { watch, setValue, handleSubmit, trigger, formState: { errors } } = form;

  const behaviorType = watch("behavior_type");
  const repeatKind   = watch("repeat_kind");
  const repeatInterval = watch("repeat_interval");
  const dueDayOffset   = watch("due_day_offset");
  const anchorMonth    = watch("anchor_month");
  const anchorDay      = watch("anchor_day");
  const anchorYear     = watch("anchor_year");
  const categoryId     = watch("category_id");
  const titleValue     = watch("title");

  const selectedPreset = useMemo(
    () => presets?.find((p) => p.id === categoryId),
    [presets, categoryId]
  );

  const orderedPresets = useMemo(() => {
    if (!presets) return [];
    const sorted = [...presets].sort(
      (a, b) => (PRESET_ORDER.indexOf(a.key) - PRESET_ORDER.indexOf(b.key)) || a.name.localeCompare(b.name)
    );
    return sorted.map((p) => (p.key === "other" ? { ...p, name: "Other (Custom)" } : p));
  }, [presets]);

  useEffect(() => {
    if (activeHousehold?.household.id) {
      setValue("household_id", activeHousehold.household.id);
    }
  }, [activeHousehold?.household.id, setValue]);

  const isPrepaidOrWallet = behaviorType === "prepaid_validity" || behaviorType === "wallet_balance";

  const repeatOptions = useMemo(() => getRepeatOptions(behaviorType), [behaviorType]);

  // Reset next_due_date override whenever schedule inputs change
  const previewAnchorDate = useMemo(
    () => buildAnchorDate(anchorMonth, anchorDay, anchorYear),
    [anchorMonth, anchorDay, anchorYear]
  );

  useEffect(() => {
    setNextDueDate(null);
  }, [previewAnchorDate, behaviorType, repeatKind, repeatInterval]);

  const previewParams = useMemo(
    () =>
      buildPreviewParams(
        behaviorType,
        repeatKind,
        repeatInterval,
        dueDayOffset,
        previewAnchorDate
      ),
    [behaviorType, repeatKind, repeatInterval, dueDayOffset, previewAnchorDate]
  );

  const { dates: previewDates, isLoading: previewLoading } = useRecurrencePreview(previewParams);

  const anchorValue: DateAnchorValue = { month: anchorMonth ?? null, day: anchorDay ?? null, year: anchorYear ?? null };

  const handleNext = async () => {
    setError(null);
    if (step === 1 && !categoryId) {
      setError("Please select a category.");
      return;
    }
    if (step === 2 && (!titleValue || !titleValue.trim())) {
      setError("Bill name is required.");
      return;
    }
    if (step === 3) {
      const ok = await trigger();
      if (!ok) {
        const firstError = Object.values(form.formState.errors)[0] as any;
        setError(firstError?.message || "Please fill all required fields correctly.");
        return;
      }
    }
    if (step < 3) setStep((s) => (s + 1) as Step);
  };

  const onSubmit = async (data: CreateBillFormData) => {
    if (!activeHousehold?.household.id) {
      setError("Household not found. Please try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 1. Find or create the household category from the preset
      let categoryIdFinal = data.category_id;
      if (selectedPreset) {
        const cat = await ensureHouseholdCategoryFromPreset(
          activeHousehold.household.id,
          selectedPreset
        );
        categoryIdFinal = cat.id;
      }

      // 2. Build anchor date from components
      const anchorDate = buildAnchorDate(data.anchor_month, data.anchor_day, data.anchor_year);

      // 3. Create the bill
      const bill = await createBill.mutateAsync({
        household_id:    activeHousehold.household.id,
        category_id:     categoryIdFinal,
        title:           data.title,
        provider_name:   data.provider_name ?? null,
        behavior_type:   data.behavior_type,
        amount_expected: data.amount_expected ?? null,
        currency:        data.currency ?? "INR",
        repeat_kind:     data.repeat_kind,
        repeat_interval: data.repeat_interval ?? null,
        is_active:       true,
        created_by:      user?.id ?? null,
        anchor_date:     anchorDate,
        next_due_date:   nextDueDate,
        generation_day_offset:       data.behavior_type === "fixed_due_date" ? (data.generation_day_offset ?? -7) : null,
        expected_payment_day_offset: data.behavior_type === "fixed_due_date" ? (data.expected_payment_day_offset ?? -3) : null,
        due_day_offset:              data.behavior_type === "fixed_due_date" ? (data.due_day_offset ?? 0) : null,
        validity_days:       null,
        check_interval_days: null,
        minimum_balance:     null,
        balance_notes:       null,
      });

      // 4. Default reminder rules
      const rules = defaultReminderRules(bill.id);
      await Promise.all(rules.map((rule) => createReminderRule(rule)));

      showToast("Bill created", "success");
      navigate(`/app/bill/${bill.id}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.error("Form Validation Failed:", errors);
    const firstError = Object.values(errors)[0] as any;
    setError(firstError?.message || "Please fill all required fields correctly.");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => (s - 1) as Step);
              }}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-primary">{STEP_LABELS[step]}</p>
          <p className="text-xs text-secondary">Step {step} of 3</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
        >
          <X size={19} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-1 rounded-full transition-all ${i < step ? "bg-accent flex-[2]" : i === step ? "bg-accent flex-[2]" : "bg-border flex-1"}`} />
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <AlertBadge variant="error">{error}</AlertBadge>
        </div>
      )}

      {/* ── Step 1: Category ───────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-primary tracking-tight mb-1">What kind of bill?</h2>
          <p className="text-sm text-secondary mb-5">Pick the category that best describes it.</p>

          {presetsLoading && <p className="text-sm text-secondary py-8 text-center">Loading categories…</p>}

          <div className="grid grid-cols-3 gap-2">
            {orderedPresets.map((p) => {
              const selected = categoryId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setValue("category_id", p.id, { shouldValidate: true });
                    setError(null);
                  }}
                  className={`relative rounded-card p-3 flex flex-col items-center gap-2 border transition-all duration-150 active:scale-[0.98] ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 text-accent">
                      <Check size={16} />
                    </span>
                  )}
                  <CategoryIconBadge icon={p.icon} color={p.color} size={36} />
                  <span className="text-xs font-medium text-center text-primary leading-snug line-clamp-2">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Details ────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-primary tracking-tight mb-5">Bill details</h2>

          <TextInput
            label="Bill name"
            id="ab-title"
            maxCharacters={120}
            value={titleValue ?? ""}
            onChange={(e) => setValue("title", e.target.value, { shouldValidate: true })}
            placeholder={selectedPreset ? (NAME_PLACEHOLDER_BY_KEY[selectedPreset.key] ?? DEFAULT_NAME_PLACEHOLDER) : DEFAULT_NAME_PLACEHOLDER}
            error={errors.title?.message}
          />

          <TextInput
            label="Provider / Vendor (optional)"
            id="ab-provider"
            maxCharacters={80}
            value={watch("provider_name") ?? ""}
            onChange={(e) => setValue("provider_name", e.target.value, { shouldValidate: true })}
            placeholder={selectedPreset ? (PROVIDER_PLACEHOLDER_BY_KEY[selectedPreset.key] ?? DEFAULT_PROVIDER_PLACEHOLDER) : DEFAULT_PROVIDER_PLACEHOLDER}
            hint="The company or service you pay"
            error={errors.provider_name?.message}
          />

          <NumericInput
            label="Expected amount"
            prefix="₹"
            value={amountValue(watch("amount_expected"))}
            onChange={(v) => setValue("amount_expected", v as any, { shouldValidate: true })}
            placeholder="0"
            hint="Leave blank if it varies each cycle"
            error={errors.amount_expected?.message as string | undefined}
          />

          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-2">
              What type of bill is this?
            </p>
            <div className="space-y-2">
              {BEHAVIOR_OPTIONS.map((opt) => {
                const selected = behaviorType === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setValue("behavior_type", opt.value as any, { shouldValidate: true });
                      setValue("repeat_kind", "monthly");
                      setError(null);
                    }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-card border text-left transition-all duration-150 ${
                      selected
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface hover:border-accent/40"
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-accent/20 text-accent" : "bg-input text-secondary"}`}>
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-primary">{opt.label}</span>
                      <span className="block text-xs text-secondary leading-snug">{opt.description}</span>
                    </span>
                    {selected && <Check size={17} className="text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Schedule ───────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-primary tracking-tight mb-1">{getStep3Title(behaviorType)}</h2>
          <p className="text-sm text-secondary mb-5">{getStep3Subtitle(behaviorType)}</p>

          <div className="space-y-1 mb-4">
            {repeatOptions.map((opt) => {
              const selected = repeatKind === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue("repeat_kind", opt.value as any, { shouldValidate: true })}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-input border transition-all duration-150 ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <Icon size={16} className={selected ? "text-accent" : "text-secondary"} />
                  <span className={`text-sm flex-1 text-left ${selected ? "font-semibold text-primary" : "text-secondary"}`}>
                    {opt.label}
                  </span>
                  {selected && <Check size={16} className="text-accent" />}
                </button>
              );
            })}
          </div>

          {/* Fixed + monthly: due day */}
          {behaviorType === "fixed_due_date" && repeatKind === "monthly" && (
            <NumericInput
              label="Which day of the month?"
              integer
              value={dueDayOffset}
              onChange={(v) => setValue("due_day_offset", v as any, { shouldValidate: true })}
              placeholder="e.g. 15"
              hint="Enter 0 for the last day of the month"
              error={errors.due_day_offset?.message}
            />
          )}

          {/* every_x_*: interval */}
          {["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind) && (
            <NumericInput
              label={`Every how many ${repeatKind === "every_x_days" ? "days" : repeatKind === "every_x_weeks" ? "weeks" : "months"}?`}
              integer
              value={repeatInterval}
              onChange={(v) => setValue("repeat_interval", v as any, { shouldValidate: true })}
              placeholder="e.g. 5"
              error={errors.repeat_interval?.message}
            />
          )}

          {/* Date anchor per matrix */}
          {isPrepaidOrWallet && repeatKind !== "monthly" && repeatKind !== "yearly" && repeatKind !== "none" && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-1 mt-2">Starting from?</p>
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
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
              error={errors.anchor_year?.message as string || errors.anchor_month?.message as string || errors.anchor_day?.message as string}
            />
          )}

          {/* Reminder note */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-accent/10 border border-accent/20 mb-4">
            <BellRing size={16} className="text-accent mt-0.5 shrink-0" />
            <p className="text-[13px] text-secondary leading-relaxed">
              Reminders are set up automatically. You can customise them from the bill details.
            </p>
          </div>

          {/* Recurrence preview */}
          {isPrepaidOrWallet && repeatKind !== "none" && anchorMonth != null && anchorDay != null && (
            <RecurrencePreview
              dates={previewDates}
              isLoading={previewLoading}
              value={nextDueDate}
              onChange={setNextDueDate}
            />
          )}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="mt-8 sticky bottom-0 bg-canvas/95 backdrop-blur py-4 -mx-4 px-4 border-t border-border lg:border-t-0 lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:px-0 lg:-mx-0">
        {step < 3 ? (
          <Button variant="accent" fullWidth size="lg" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="accent"
            fullWidth
            size="lg"
            loading={submitting}
            onClick={handleSubmit(onSubmit, onInvalid)}
          >
            Save bill
          </Button>
        )}
      </div>
    </div>
  );
}

function amountValue(v: unknown): number | null | undefined {
  return typeof v === "number" ? v : undefined;
}