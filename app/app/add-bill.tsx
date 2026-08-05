import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { NumericInput } from "../components/ui/NumericInput";
import { IconButton } from "../components/ui/IconButton";
import { Divider } from "../components/ui/Divider";
import { AlertBadge } from "../components/ui/AlertBadge";
import { CategoryIconBadge } from "../components/bills/CategoryPill";
import { DateAnchorPicker, buildAnchorDate } from "../components/ui/DateAnchorPicker";
import { RecurrencePreview } from "../components/bills/RecurrencePreview";

import { useCategoryPresets } from "../hooks/useCategories";
import { useHousehold } from "../hooks/useHousehold";
import { useCreateBill } from "../hooks/useBills";
import { useCreateReminderRule } from "../hooks/useReminders";
import { useTapGuard } from "../hooks/useTapGuard";
import { useAuthStore } from "../stores/auth-store";
import { defaultReminderRules } from "../lib/supabase/reminders";
import { ensureHouseholdCategoryFromPreset } from "../lib/supabase/categories";
import { createBillSchema, CreateBillFormData, DUE_DATE_YEAR_MIN, DUE_DATE_YEAR_MAX } from "../schemas/bill";
import { humanize } from "../lib/errors";
import type { CategoryPreset } from "../lib/supabase/types";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Category",
  2: "Details",
  3: "Schedule",
};

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
  {
    value: "fixed_due_date" as const,
    label: "Fixed due date",
    icon: "calendar-outline" as const,
    description: "Due on a specific day each cycle — electricity, rent, EMI, etc.",
  },
  {
    value: "prepaid_validity" as const,
    label: "Prepaid / Recharge",
    icon: "time-outline" as const,
    description: "Pay upfront — mobile recharge, OTT, annual plans, etc.",
  },
  {
    value: "wallet_balance" as const,
    label: "Wallet / Balance",
    icon: "wallet-outline" as const,
    description: "Balance-based — check periodically and top up when low.",
  },
];

// ── Recurrence options per behaviour type ───────────────────────────────────

function getRepeatOptions(bt: string) {
  if (bt === "fixed_due_date") {
    return [
      { value: "monthly" as const, label: "Monthly",     icon: "calendar-outline" as const },
      { value: "yearly"  as const, label: "Yearly",      icon: "calendar-outline" as const },
      { value: "none"    as const, label: "One-time",    icon: "flash-outline"    as const },
    ];
  }
  // Prepaid / Wallet
  return [
    { value: "monthly"        as const, label: "Monthly",          icon: "calendar-outline"  as const },
    { value: "yearly"         as const, label: "Yearly",           icon: "calendar-outline"  as const },
    { value: "every_x_days"   as const, label: "Every X days",     icon: "repeat-outline"    as const },
    { value: "every_x_weeks"  as const, label: "Every X weeks",    icon: "repeat-outline"    as const },
    { value: "every_x_months" as const, label: "Every X months",   icon: "repeat-outline"    as const },
    { value: "none"           as const, label: "One-time",         icon: "flash-outline"     as const },
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

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <View
      className="flex-row items-center gap-1"
      accessibilityRole="progressbar"
      accessibilityValue={{ now: current, min: 1, max: total }}
      accessibilityLabel={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 rounded-full ${
            i < current ? "bg-accent" : "bg-border"
          }`}
          style={{ flex: i < current ? 2 : 1 }}
        />
      ))}
    </View>
  );
}

// ── Category grid item ────────────────────────────────────────────────────────

function CategoryItem({
  preset,
  selected,
  onSelect,
}: {
  preset:   CategoryPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  // Per-cell guard: double-taps on the SAME category are ignored, but
  // switching between different categories is never throttled.
  const guard = useTapGuard(300);

  return (
    <Pressable
      onPress={() => {
        if (!guard()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      accessibilityRole="radio"
      accessibilityLabel={preset.name}
      accessibilityState={{ selected }}
      className={`rounded-card p-3 items-center gap-2 border ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {selected && (
        <View className="absolute top-1.5 right-1.5">
          <Ionicons name="checkmark-circle" size={16} className="text-accent" />
        </View>
      )}
      <CategoryIconBadge icon={preset.icon} color={preset.color} size={36} selected={selected} />
      <Text
        className="text-caption font-medium mt-1 text-center text-primary"
        numberOfLines={2}
      >
        {preset.name}
      </Text>
    </Pressable>
  );
}

// ── Option button ─────────────────────────────────────────────────────────────

function OptionButton({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label:       string;
  description?: string;
  icon:        keyof typeof Ionicons.glyphMap;
  selected:    boolean;
  onPress:     () => void;
}) {
  const guard = useTapGuard(300);

  return (
    <Pressable
      onPress={() => {
        if (!guard()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`flex-row items-start gap-3 p-4 rounded-card border mb-2 ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View
        className={`w-9 h-9 rounded-input items-center justify-center mt-0.5 ${
          selected ? "bg-accent border border-accent" : "bg-surface border border-border"
        }`}
      >
        <Ionicons
          name={icon}
          size={18}
          className={selected ? "text-accent-text" : "text-primary"}
        />
      </View>
      <View className="flex-1">
        <Text className="text-label font-semibold text-primary">
          {label}
        </Text>
        {description ? (
          <Text className="text-caption text-secondary mt-0.5">
            {description}
          </Text>
        ) : null}
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} className="text-accent" />
      )}
    </Pressable>
  );
}

// ── Repeat kind option (step 3) ───────────────────────────────────────────────

function RepeatKindOption({
  label,
  icon,
  selected,
  onSelect,
}: {
  label:    string;
  icon:     keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onSelect: () => void;
}) {
  const guard = useTapGuard(300);

  return (
    <Pressable
      onPress={() => {
        if (!guard()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      className={`flex-row items-center gap-3 px-4 py-3.5 rounded-card border mb-2 ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View
        className={`w-8 h-8 rounded-input items-center justify-center ${
          selected
            ? "bg-accent"
            : "bg-surface border border-border"
        }`}
      >
        <Ionicons
          name={icon}
          size={16}
          className={selected ? "text-accent-text" : "text-primary"}
        />
      </View>
      <Text
        className={`text-body flex-1 ${
          selected
            ? "text-accent font-semibold"
            : "text-primary"
        }`}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={18} className="text-accent" />
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddBillScreen() {
  const [step, setStep]         = useState<Step>(1);
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextDueDate, setNextDueDate] = useState<string | null>(null);

  const { data: rawPresets = [], isLoading: presetsLoading } = useCategoryPresets();

  const presets = useMemo(() => {
    const order = [
      "broadband", "rent", "credit_card", "domain", "education",
      "electricity", "emi", "gas", "gym", "health", "hosting",
      "insurance", "investments", "loan", "subscriptions", "music",
      "water", "ott", "mobile_recharge", "cloud_services", "other",
    ];
    return [...rawPresets]
      .sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((p) => (p.key === "other" ? { ...p, name: "Other (Custom)" } : p));
  }, [rawPresets]);

  const { activeHousehold } = useHousehold();
  const { mutateAsync: createBill }         = useCreateBill();
  const { mutateAsync: createReminderRule } = useCreateReminderRule();
  const { user } = useAuthStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateBillFormData>({
    resolver: zodResolver(createBillSchema),
    defaultValues: {
      household_id:   activeHousehold?.household.id ?? "",
      behavior_type:  "fixed_due_date",
      repeat_kind:    "monthly",
      currency:       "INR",
    },
    mode: "onBlur",
  });

  const selectedPresetKey = watch("category_id");
  const behaviorType      = watch("behavior_type");
  const repeatKind        = watch("repeat_kind");
  const anchorMonth       = watch("anchor_month");
  const anchorDay         = watch("anchor_day");
  const anchorYear        = watch("anchor_year");
  const dueDayOffset      = watch("due_day_offset");
  const repeatInterval    = watch("repeat_interval");

  const selectedPreset = presets.find((p) => p.id === selectedPresetKey);
  const isPrepaidOrWallet = behaviorType === "prepaid_validity" || behaviorType === "wallet_balance";
  const repeatOptions = useMemo(() => getRepeatOptions(behaviorType), [behaviorType]);

  // Screen-level guards: rapid repeat taps on the primary actions (Next,
  // Back, Close, Save) are swallowed. Long enough to absorb an impatient
  // double-tap, short enough that deliberate presses never wait.
  const guardAction = useTapGuard(300);
  const guardSubmit = useTapGuard(400);

  const handleClose = () => {
    if (!guardAction()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const titleValue = watch("title");

  const handleNext = useCallback(() => {
    if (!guardAction()) return;
    if (step === 1 && !selectedPresetKey) {
      setError("Please select a category.");
      return;
    }
    if (step === 2 && (!titleValue || !titleValue.trim())) {
      setError("Bill name is required.");
      return;
    }
    setError(null);
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [step, selectedPresetKey, titleValue, guardAction]);

  const handleBack = () => {
    if (!guardAction()) return;
    setError(null);
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onSubmit = async (data: CreateBillFormData) => {
    // Hard guard against double-submit — two rapid taps on "Save bill"
    // must never create two bills.
    if (!guardSubmit()) return;
    if (!activeHousehold?.household.id) {
      setError("Household not found. Please try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 1. Find or create the category
      const preset = presets.find((p) => p.id === data.category_id);
      let categoryId = data.category_id;
      if (preset) {
        const cat = await ensureHouseholdCategoryFromPreset(activeHousehold.household.id, preset);
        categoryId = cat.id;
      }

      // 2. Build anchor_date from components
      const anchorDate = buildAnchorDate(data.anchor_month, data.anchor_day, data.anchor_year);

      // 3. Determine repeat_interval for non-interval types
      let finalRepeatInterval = data.repeat_interval ?? null;

      // 4. Create the bill
      const bill = await createBill({
        household_id:    activeHousehold.household.id,
        category_id:     categoryId,
        title:           data.title,
        provider_name:   data.provider_name   ?? null,
        behavior_type:   data.behavior_type,
        amount_expected: data.amount_expected  ?? null,
        currency:        data.currency         ?? "INR",
        repeat_kind:     data.repeat_kind,
        repeat_interval: finalRepeatInterval,
        is_active:       true,
        created_by:      user?.id ?? null,
        anchor_date:     anchorDate,
        // Next due date override (null = auto: first future occurrence)
        next_due_date:   nextDueDate,
        // Fixed due date fields
        generation_day_offset:       data.behavior_type === "fixed_due_date" ? (data.generation_day_offset       ?? -7) : null,
        expected_payment_day_offset: data.behavior_type === "fixed_due_date" ? (data.expected_payment_day_offset ?? -3) : null,
        due_day_offset:              data.behavior_type === "fixed_due_date" ? (data.due_day_offset               ?? 0)  : null,
        // Deprecated
        validity_days:       null,
        check_interval_days: null,
        minimum_balance:     null,
        balance_notes:       null,
      });

      // Guarded against rapid re-entry (cooldown) — never proceed without a bill
      if (!bill) return;

      // 5. Create default reminder rules
      const rules = defaultReminderRules(bill.id);
      await Promise.all(rules.map((rule) => createReminderRule(rule)));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bill/${bill.id}`);
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => {
    setError("Please fill all required fields correctly.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  // ── Build preview anchor date string ──────────────────────────────────────
  const previewAnchorDate = useMemo(
    () => buildAnchorDate(anchorMonth, anchorDay, anchorYear),
    [anchorMonth, anchorDay, anchorYear],
  );

  // A next-due selection is tied to the anchor — reset it when the anchor
  // (or schedule) changes so a stale date is never silently submitted.
  useEffect(() => {
    setNextDueDate(null);
  }, [previewAnchorDate, behaviorType, repeatKind, repeatInterval]);

  const showPreview =
    isPrepaidOrWallet &&
    repeatKind !== "none" &&
    anchorMonth != null &&
    anchorDay != null &&
    (["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind)
      ? repeatInterval != null && repeatInterval > 0
      : true);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="px-4 pt-2 pb-3 bg-canvas">
          <View className="flex-row items-center justify-between mb-3">
            {step > 1 ? (
              <IconButton
                icon={<Ionicons name="chevron-back" size={22} className="text-primary" />}
                onPress={handleBack}
                accessibilityLabel="Go back"
                variant="ghost"
              />
            ) : (
              <View className="w-10" />
            )}
            <View className="items-center">
              <Text className="text-label text-primary font-semibold">
                {STEP_LABELS[step]}
              </Text>
              <Text className="text-caption text-secondary">
                Step {step} of 3
              </Text>
            </View>
            <IconButton
              icon={<Ionicons name="close" size={22} className="text-primary" />}
              onPress={handleClose}
              accessibilityLabel="Close"
              variant="ghost"
            />
          </View>
          <StepIndicator current={step} total={3} />
        </View>

        <Divider />

        {/* ── Content ────────────────────────────────────────────────── */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View className="mb-4">
              <AlertBadge message={error} variant="error" />
            </View>
          )}

          {/* ── Step 1: Category ────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text className="text-title text-primary font-semibold mb-1">
                What kind of bill?
              </Text>
              <Text className="text-body text-secondary mb-5">
                Pick the category that best describes it.
              </Text>
              {presetsLoading ? (
                <View className="items-center py-8">
                  <Text className="text-body text-secondary">Loading categories…</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {presets.map((preset) => (
                    <View key={preset.id} style={{ width: "30.5%" }}>
                      <CategoryItem
                        preset={preset}
                        selected={selectedPresetKey === preset.id}
                        onSelect={() => {
                          setValue("category_id", preset.id);
                          setError(null);
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Details ─────────────────────────────────────── */}
          {step === 2 && (
            <View className="gap-5">
              <View>
                <Text className="text-title text-primary font-semibold mb-1">
                  What's the bill called?
                </Text>
                <Text className="text-body text-secondary">
                  Give it a name so you can recognise it at a glance.
                </Text>
              </View>

              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    label="Bill name"
                    placeholder={
                      selectedPreset
                        ? (NAME_PLACEHOLDER_BY_KEY[selectedPreset.key] ?? DEFAULT_NAME_PLACEHOLDER)
                        : DEFAULT_NAME_PLACEHOLDER
                    }
                    autoCapitalize="words"
                    returnKeyType="next"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.title?.message}
                    maxCharacters={120}
                  />
                )}
              />

              <Controller
                control={control}
                name="provider_name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    label="Provider / Vendor (optional)"
                    placeholder={
                      selectedPreset
                        ? (PROVIDER_PLACEHOLDER_BY_KEY[selectedPreset.key] ?? DEFAULT_PROVIDER_PLACEHOLDER)
                        : DEFAULT_PROVIDER_PLACEHOLDER
                    }
                    autoCapitalize="words"
                    returnKeyType="next"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value ?? ""}
                    hint="The company or service you pay"
                    maxCharacters={80}
                  />
                )}
              />

              <Controller
                control={control}
                name="amount_expected"
                render={({ field: { onChange, onBlur, value } }) => (
                  <NumericInput
                    label="Expected amount"
                    placeholder="0"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onBlur={onBlur}
                    onChange={onChange}
                    value={value ?? undefined}
                    error={errors.amount_expected?.message}
                    hint="Leave blank if it varies each cycle"
                    leadingIcon={
                      <Text className="text-body text-secondary font-medium">₹</Text>
                    }
                  />
                )}
              />

              <View>
                <Text className="text-label text-primary font-medium mb-2">
                  What type of bill is this?
                </Text>
                {BEHAVIOR_OPTIONS.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    label={opt.label}
                    description={opt.description}
                    icon={opt.icon}
                    selected={behaviorType === opt.value}
                    onPress={() => {
                      setValue("behavior_type", opt.value);
                      // Reset repeat_kind to monthly when switching behaviour
                      setValue("repeat_kind", "monthly");
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Step 3: Schedule ──────────────────────────────────── */}
          {step === 3 && (
            <View className="gap-5">
              <View>
                <Text className="text-title text-primary font-semibold mb-1">
                  {getStep3Title(behaviorType)}
                </Text>
                <Text className="text-body text-secondary">
                  {getStep3Subtitle(behaviorType)}
                </Text>
              </View>

              {/* ── Repeat kind selector ──────────────────────────── */}
              <View>
                <Text className="text-label text-primary font-medium mb-2">
                  {isPrepaidOrWallet ? "How does this repeat?" : "How often?"}
                </Text>
                {repeatOptions.map((opt) => (
                  <RepeatKindOption
                    key={opt.value}
                    label={opt.label}
                    icon={opt.icon}
                    selected={repeatKind === opt.value}
                    onSelect={() => setValue("repeat_kind", opt.value)}
                  />
                ))}
              </View>

              {/* ── Fixed Due Date: Monthly ────────────────────────── */}
              {behaviorType === "fixed_due_date" && repeatKind === "monthly" && (
                <Controller
                  control={control}
                  name="due_day_offset"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <NumericInput
                      label="Which day of the month?"
                      placeholder="e.g. 15"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onBlur={onBlur}
                      onChange={onChange}
                      value={value ?? undefined}
                      error={errors.due_day_offset?.message}
                      hint="Enter 0 for the last day of the month"
                    />
                  )}
                />
              )}

              {/* ── Fixed Due Date: Yearly ─────────────────────────── */}
              {behaviorType === "fixed_due_date" && repeatKind === "yearly" && (
                <View>
                  <Text className="text-label text-primary font-medium mb-3">
                    Which date each year?
                  </Text>
                  <Controller
                    control={control}
                    name="anchor_month"
                    render={({ field: { onChange, value } }) => (
                      <DateAnchorPicker
                        showMonth
                        showDay
                        month={value}
                        day={anchorDay}
                        onMonthChange={onChange}
                        onDayChange={(d) => setValue("anchor_day", d)}
                        dateLabel="Due date"
                        errors={{
                          month: errors.anchor_month?.message,
                          day:   errors.anchor_day?.message,
                        }}
                      />
                    )}
                  />
                </View>
              )}

              {/* ── Fixed Due Date: One-time ───────────────────────── */}
              {behaviorType === "fixed_due_date" && repeatKind === "none" && (
                <View>
                  <Text className="text-label text-primary font-medium mb-3">
                    When is this bill due?
                  </Text>
                  <Controller
                    control={control}
                    name="anchor_month"
                    render={({ field: { onChange, value } }) => (
                      <DateAnchorPicker
                        showMonth
                        showDay
                        showYear
                        month={value}
                        day={anchorDay}
                        year={anchorYear}
                        onMonthChange={onChange}
                        onDayChange={(d) => setValue("anchor_day", d)}
                        onYearChange={(y) => setValue("anchor_year", y)}
                        dateLabel="Due date"
                        order="DMY"
                        yearMin={DUE_DATE_YEAR_MIN}
                        yearMax={DUE_DATE_YEAR_MAX}
                        errors={{
                          month: errors.anchor_month?.message,
                          day:   errors.anchor_day?.message,
                          year:  errors.anchor_year?.message,
                        }}
                      />
                    )}
                  />
                </View>
              )}

              {/* ── Prepaid / Wallet: Monthly ──────────────────────── */}
              {isPrepaidOrWallet && repeatKind === "monthly" && (
                <View>
                  <Text className="text-label text-primary font-medium mb-3">
                    Which day of each month?
                  </Text>
                  <Controller
                    control={control}
                    name="anchor_month"
                    render={({ field: { onChange, value } }) => (
                      <DateAnchorPicker
                        showMonth
                        showDay
                        month={value}
                        day={anchorDay}
                        onMonthChange={onChange}
                        onDayChange={(d) => setValue("anchor_day", d)}
                        dateLabel="Last payment date"
                        errors={{
                          month: errors.anchor_month?.message,
                          day:   errors.anchor_day?.message,
                        }}
                      />
                    )}
                  />
                </View>
              )}

              {/* ── Prepaid / Wallet: Yearly ───────────────────────── */}
              {isPrepaidOrWallet && repeatKind === "yearly" && (
                <View>
                  <Text className="text-label text-primary font-medium mb-3">
                    Which date each year?
                  </Text>
                  <Controller
                    control={control}
                    name="anchor_month"
                    render={({ field: { onChange, value } }) => (
                      <DateAnchorPicker
                        showMonth
                        showDay
                        month={value}
                        day={anchorDay}
                        onMonthChange={onChange}
                        onDayChange={(d) => setValue("anchor_day", d)}
                        dateLabel="Last payment date"
                        errors={{
                          month: errors.anchor_month?.message,
                          day:   errors.anchor_day?.message,
                        }}
                      />
                    )}
                  />
                </View>
              )}

              {/* ── Prepaid / Wallet: Every X Days/Weeks/Months ────── */}
              {isPrepaidOrWallet &&
                ["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind) && (
                <View className="gap-4">
                  <Controller
                    control={control}
                    name="repeat_interval"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <NumericInput
                        label={`Every how many ${
                          repeatKind === "every_x_days"   ? "days" :
                          repeatKind === "every_x_weeks"  ? "weeks" : "months"
                        }?`}
                        placeholder="e.g. 5"
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onBlur={onBlur}
                        onChange={onChange}
                        value={value ?? undefined}
                        error={errors.repeat_interval?.message}
                      />
                    )}
                  />

                  <View>
                    <Text className="text-label text-primary font-medium mb-3">
                      Starting from?
                    </Text>
                    <Controller
                      control={control}
                      name="anchor_month"
                      render={({ field: { onChange, value } }) => (
                        <DateAnchorPicker
                          showMonth
                          showDay
                          showYear={repeatKind !== "every_x_months"}
                          month={value}
                          day={anchorDay}
                          year={anchorYear}
                          onMonthChange={onChange}
                          onDayChange={(d) => setValue("anchor_day", d)}
                          onYearChange={(y) => setValue("anchor_year", y)}
                          dateLabel="Last payment date"
                          errors={{
                            month: errors.anchor_month?.message,
                            day:   errors.anchor_day?.message,
                            year:  errors.anchor_year?.message,
                          }}
                        />
                      )}
                    />
                  </View>
                </View>
              )}

              {/* ── Prepaid / Wallet: One-time ─────────────────────── */}
              {isPrepaidOrWallet && repeatKind === "none" && (
                <View>
                  <Text className="text-label text-primary font-medium mb-3">
                    When is this due?
                  </Text>
                  <Controller
                    control={control}
                    name="anchor_month"
                    render={({ field: { onChange, value } }) => (
                      <DateAnchorPicker
                        showMonth
                        showDay
                        showYear
                        month={value}
                        day={anchorDay}
                        year={anchorYear}
                        onMonthChange={onChange}
                        onDayChange={(d) => setValue("anchor_day", d)}
                        onYearChange={(y) => setValue("anchor_year", y)}
                        dateLabel="Due date"
                        order="DMY"
                        yearMin={DUE_DATE_YEAR_MIN}
                        yearMax={DUE_DATE_YEAR_MAX}
                        errors={{
                          month: errors.anchor_month?.message,
                          day:   errors.anchor_day?.message,
                          year:  errors.anchor_year?.message,
                        }}
                      />
                    )}
                  />
                </View>
              )}

              {/* ── Live preview ────────────────────────────────────── */}
              {showPreview && (
                <RecurrencePreview
                  behaviorType={behaviorType}
                  repeatKind={repeatKind}
                  repeatInterval={repeatInterval}
                  dueDayOffset={dueDayOffset}
                  anchorDate={previewAnchorDate}
                  value={nextDueDate}
                  onChange={setNextDueDate}
                />
              )}

              {/* ── Reminder note ──────────────────────────────────── */}
              <View className="bg-neutral-100 dark:bg-neutral-800 rounded-card p-4 flex-row gap-2">
                <Ionicons name="notifications-outline" size={18} className="text-primary" />
                <Text className="text-caption text-secondary flex-1 leading-5">
                  Reminders are set up automatically. You can customise them from the bill details.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom action bar ────────────────────────────────────── */}
        <Divider />
        <View className="px-4 py-3 bg-canvas">
          {step < 3 ? (
            <Button
              title="Next"
              variant="accent"
              fullWidth
              onPress={handleNext}
            />
          ) : (
            <Button
              title="Save bill"
              variant="accent"
              fullWidth
              onPress={handleSubmit(onSubmit, onInvalid)}
              loading={submitting}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
