import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { IconButton } from "../components/ui/IconButton";
import { Divider } from "../components/ui/Divider";
import { AlertBadge } from "../components/ui/AlertBadge";
import { CategoryIconBadge } from "../components/bills/CategoryPill";

import { useCategoryPresets } from "../hooks/useCategories";
import { useHousehold } from "../hooks/useHousehold";
import { useCreateBill } from "../hooks/useBills";
import { useCreateReminderRule } from "../hooks/useReminders";
import { useAuthStore } from "../stores/auth-store";
import { defaultReminderRules } from "../lib/supabase/reminders";
import { ensureHouseholdCategoryFromPreset } from "../lib/supabase/categories";
import { createBillSchema, CreateBillFormData } from "../schemas/bill";
import { Colors } from "../lib/theme";
import { humanize } from "../lib/errors";
import type { CategoryPreset } from "../lib/supabase/types";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Category",
  2: "Details",
  3: "Recurrence",
};

// ── Per-category placeholders ───────────────────────────────────────────────
// Keyed by category_presets.key (see supabase/migrations/012_seed_category_presets.sql)

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
    description: "Bill is due on a specific day each cycle (electricity, rent, etc.)",
  },
  {
    value: "prepaid_validity" as const,
    label: "Prepaid / Validity",
    icon: "time-outline" as const,
    description: "You pay upfront and it's valid for N days (mobile recharge, etc.)",
  },
  {
    value: "wallet_balance" as const,
    label: "Wallet / Balance",
    icon: "wallet-outline" as const,
    description: "Balance-based service that needs periodic top-up (streaming wallet, etc.)",
  },
];

const REPEAT_OPTIONS = [
  { value: "monthly" as const,        label: "Monthly",           needsInterval: false },
  { value: "yearly" as const,         label: "Yearly",            needsInterval: false },
  { value: "every_x_days" as const,   label: "Every X days",      needsInterval: true  },
  { value: "every_x_weeks" as const,  label: "Every X weeks",     needsInterval: true  },
  { value: "every_x_months" as const, label: "Every X months",    needsInterval: true  },
  { value: "none" as const,           label: "One-time (no repeat)", needsInterval: false },
];

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
  return (
    <Pressable
      onPress={() => {
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
      <CategoryIconBadge icon={preset.icon} color={preset.color} size={36} />
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
  return (
    <Pressable
      onPress={() => {
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
        <Text
          className="text-label font-semibold text-primary"
        >
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddBillScreen() {
  const [step, setStep]         = useState<Step>(1);
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: rawPresets = [], isLoading: presetsLoading } = useCategoryPresets();
  
  const presets = [...rawPresets].sort((a, b) => {
    const order = [
      "broadband",
      "rent",
      "credit_card",
      "domain",
      "education",
      "electricity",
      "emi",
      "gas",
      "gym",
      "health",
      "hosting",
      "insurance",
      "investments",
      "loan",
      "subscriptions",
      "music",
      "water",
      "ott",
      "mobile_recharge",
      "cloud_services",
      "other"
    ];
    const indexA = order.indexOf(a.key);
    const indexB = order.indexOf(b.key);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.name.localeCompare(b.name);
  }).map(preset => preset.key === "other" ? { ...preset, name: "Other (Custom)" } : preset);
  
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
  const needsInterval     = ["every_x_days","every_x_weeks","every_x_months"].includes(repeatKind);

  // Find the full preset object for the selected category
  const selectedPreset = presets.find(p => p.id === selectedPresetKey);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const titleValue = watch("title");

  const handleNext = useCallback(() => {
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
  }, [step, selectedPresetKey, titleValue]);

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onSubmit = async (data: CreateBillFormData) => {
    if (!activeHousehold?.household.id) {
      setError("Household not found. Please try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 1. Find or create the category in the household
      const preset = presets.find(p => p.id === data.category_id);
      let categoryId = data.category_id;
      if (preset) {
        const cat = await ensureHouseholdCategoryFromPreset(activeHousehold.household.id, preset);
        categoryId = cat.id;
      }

      // 2. Create the bill
      const bill = await createBill({
        household_id:    activeHousehold.household.id,
        category_id:     categoryId,
        title:           data.title,
        provider_name:   data.provider_name   ?? null,
        behavior_type:   data.behavior_type,
        amount_expected: data.amount_expected  ?? null,
        currency:        data.currency         ?? "INR",
        repeat_kind:     data.repeat_kind,
        repeat_interval: data.repeat_interval  ?? null,
        is_active:       true,
        created_by:      user?.id ?? null,
        // Null out fields not relevant to the behavior type
        validity_days:       data.behavior_type === "prepaid_validity" ? (data.validity_days       ?? null) : null,
        check_interval_days: data.behavior_type === "wallet_balance"   ? (data.check_interval_days ?? null) : null,
        minimum_balance:     data.behavior_type === "wallet_balance"   ? (data.minimum_balance     ?? null) : null,
        balance_notes:       data.behavior_type === "wallet_balance"   ? (data.balance_notes       ?? null) : null,
        generation_day_offset:       data.behavior_type === "fixed_due_date" ? (data.generation_day_offset       ?? -7) : null,
        expected_payment_day_offset: data.behavior_type === "fixed_due_date" ? (data.expected_payment_day_offset ?? -3) : null,
        due_day_offset:              data.behavior_type === "fixed_due_date" ? (data.due_day_offset               ?? 0)  : null,
      });

      // 3. Create default reminder rules
      const rules = defaultReminderRules(bill.id);
      await Promise.all(rules.map(rule => createReminderRule(rule)));

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

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
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
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap:      "wrap",
                    gap:           8,
                  }}
                >
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
                  Bill details
                </Text>
                {selectedPreset && (
                  <Text className="text-body text-secondary">
                    Adding a {selectedPreset.name.toLowerCase()} bill.
                  </Text>
                )}
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
                  <TextInput
                    label="Expected amount (optional)"
                    placeholder="0"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value != null ? String(value) : ""}
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
                  Bill type
                </Text>
                {BEHAVIOR_OPTIONS.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    label={opt.label}
                    description={opt.description}
                    icon={opt.icon}
                    selected={behaviorType === opt.value}
                    onPress={() => setValue("behavior_type", opt.value)}
                  />
                ))}
              </View>

              {/* Prepaid: validity days */}
              {behaviorType === "prepaid_validity" && (
                <Controller
                  control={control}
                  name="validity_days"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Validity period (days)"
                      placeholder="e.g. 28"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onBlur={onBlur}
                      onChangeText={(t) => {
                        const parsed = parseInt(t);
                        onChange(isNaN(parsed) ? undefined : parsed);
                      }}
                      value={value != null ? String(value) : ""}
                      error={errors.validity_days?.message}
                      hint="How many days after payment is the service active?"
                    />
                  )}
                />
              )}

              {/* Wallet: check interval + minimum balance */}
              {behaviorType === "wallet_balance" && (
                <>
                  <Controller
                    control={control}
                    name="check_interval_days"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        label="Check every (days)"
                        placeholder="e.g. 30"
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onBlur={onBlur}
                        onChangeText={(t) => {
                          const parsed = parseInt(t);
                          onChange(isNaN(parsed) ? undefined : parsed);
                        }}
                        value={value != null ? String(value) : ""}
                        error={errors.check_interval_days?.message}
                        hint="How often should we remind you to check the balance?"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="minimum_balance"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        label="Alert below balance (optional)"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        onBlur={onBlur}
                        onChangeText={(t) => {
                          const parsed = parseFloat(t);
                          onChange(isNaN(parsed) ? undefined : parsed);
                        }}
                        value={value != null ? String(value) : ""}
                        leadingIcon={
                          <Text className="text-body text-secondary font-medium">₹</Text>
                        }
                      />
                    )}
                  />
                </>
              )}
            </View>
          )}

          {/* ── Step 3: Recurrence ──────────────────────────────────── */}
          {step === 3 && (
            <View className="gap-5">
              <View>
                <Text className="text-title text-primary font-semibold mb-1">
                  How often?
                </Text>
                <Text className="text-body text-secondary">
                  Set the payment frequency for this bill.
                </Text>
              </View>

              <View>
                {REPEAT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setValue("repeat_kind", opt.value);
                    }}
                    className={`flex-row items-center justify-between px-4 py-3.5 border-b border-neutral-100 dark:border-neutral-800 ${
                      repeatKind === opt.value ? "bg-accent/10" : ""
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text
                      className={`text-body ${
                        repeatKind === opt.value
                          ? "text-accent font-semibold"
                          : "text-primary"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {repeatKind === opt.value && (
                      <Ionicons name="checkmark" size={18} className="text-accent" />
                    )}
                  </Pressable>
                ))}
              </View>

              {needsInterval && (
                <Controller
                  control={control}
                  name="repeat_interval"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label={`Every how many ${
                        repeatKind === "every_x_days"   ? "days" :
                        repeatKind === "every_x_weeks"  ? "weeks" : "months"
                      }?`}
                      placeholder="e.g. 2"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onBlur={onBlur}
                      onChangeText={(t) => {
                        const parsed = parseInt(t);
                        onChange(isNaN(parsed) ? undefined : parsed);
                      }}
                      value={value != null ? String(value) : ""}
                      error={errors.repeat_interval?.message}
                    />
                  )}
                />
              )}

              {/* Fixed due date: day-of-month the bill is due */}
              {behaviorType === "fixed_due_date" && (
                <Controller
                  control={control}
                  name="due_day_offset"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Due on day (of month)"
                      placeholder="e.g. 5 (5th of each month)"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onBlur={onBlur}
                      onChangeText={(t) => {
                        const parsed = parseInt(t);
                        onChange(isNaN(parsed) ? undefined : parsed);
                      }}
                      value={value != null ? String(value) : ""}
                      error={errors.due_day_offset?.message}
                      hint="Enter 0 to use end-of-cycle (last day)"
                    />
                  )}
                />
              )}

              {/* Reminder note */}
              <View className="bg-neutral-100 dark:bg-neutral-800 rounded-card p-4 flex-row gap-2">
                <Ionicons name="notifications-outline" size={18} className="text-primary" />
                <Text className="text-caption text-secondary flex-1 leading-5">
                  We'll create default reminders: 3 days before and on the due date. You can customise them later from the bill details.
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
