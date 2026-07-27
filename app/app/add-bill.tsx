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
import { defaultReminderRules } from "../lib/supabase/reminders";
import { ensureHouseholdCategoryFromPreset } from "../lib/supabase/categories";
import { createBillSchema, CreateBillFormData } from "../schemas/bill";
import { Colors } from "../lib/theme";
import type { CategoryPreset } from "../lib/supabase/types";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Category",
  2: "Details",
  3: "Recurrence",
};

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
    <View className="flex-row items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 rounded-full ${
            i < current ? "bg-accent-500" : "bg-neutral-200 dark:bg-neutral-700"
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
      accessibilityState={{ selected }}
      className={`rounded-card p-3 items-center gap-2 border ${
        selected
          ? "border-accent-500 bg-accent-50 dark:bg-accent-950"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <CategoryIconBadge icon={preset.icon} color={preset.color} size={36} />
      <Text
        className={`text-caption text-center ${
          selected
            ? "text-accent-600 dark:text-accent-400 font-semibold"
            : "text-neutral-700 dark:text-neutral-300 font-medium"
        }`}
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
      accessibilityState={{ selected }}
      className={`flex-row items-start gap-3 p-4 rounded-card border mb-2 ${
        selected
          ? "border-accent-500 bg-accent-50 dark:bg-accent-950"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View
        className={`w-9 h-9 rounded-input items-center justify-center mt-0.5 ${
          selected ? "bg-accent-500" : "bg-neutral-100 dark:bg-neutral-800"
        }`}
      >
        <Ionicons
          name={icon}
          size={18}
          color={selected ? Colors.white : Colors.neutral[500]}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-label font-semibold ${
            selected
              ? "text-accent-700 dark:text-accent-300"
              : "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {label}
        </Text>
        {description ? (
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 mt-0.5">
            {description}
          </Text>
        ) : null}
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={Colors.accent[500]} />
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddBillScreen() {
  const [step, setStep]         = useState<Step>(1);
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: presets = [], isLoading: presetsLoading } = useCategoryPresets();
  const { data: householdData } = useHousehold();
  const { mutateAsync: createBill }         = useCreateBill();
  const { mutateAsync: createReminderRule } = useCreateReminderRule();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateBillFormData>({
    resolver: zodResolver(createBillSchema),
    defaultValues: {
      household_id:   householdData?.household.id ?? "",
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

  const handleNext = useCallback(() => {
    if (step === 1 && !selectedPresetKey) {
      setError("Please select a category.");
      return;
    }
    setError(null);
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [step, selectedPresetKey]);

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onSubmit = async (data: CreateBillFormData) => {
    if (!householdData?.household.id) {
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
        const cat = await ensureHouseholdCategoryFromPreset(householdData.household.id, preset);
        categoryId = cat.id;
      }

      // 2. Create the bill
      const bill = await createBill({
        ...data,
        category_id:  categoryId,
        household_id: householdData.household.id,
        is_active:    true,
        created_by:   undefined,
        // Null out fields not relevant to the behavior type
        validity_days:       data.behavior_type === "prepaid_validity" ? (data.validity_days ?? null) : null,
        check_interval_days: data.behavior_type === "wallet_balance"   ? (data.check_interval_days ?? null) : null,
        minimum_balance:     data.behavior_type === "wallet_balance"   ? (data.minimum_balance ?? null) : null,
        balance_notes:       data.behavior_type === "wallet_balance"   ? (data.balance_notes ?? null) : null,
        generation_day_offset:       data.behavior_type === "fixed_due_date" ? (data.generation_day_offset ?? -7) : null,
        expected_payment_day_offset: data.behavior_type === "fixed_due_date" ? (data.expected_payment_day_offset ?? -3) : null,
        due_day_offset:              data.behavior_type === "fixed_due_date" ? (data.due_day_offset ?? 0) : null,
      });

      // 3. Create default reminder rules
      const rules = defaultReminderRules(bill.id);
      await Promise.all(rules.map(rule => createReminderRule(rule)));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bill/${bill.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save bill. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="px-4 pt-2 pb-3 bg-neutral-50 dark:bg-neutral-950">
          <View className="flex-row items-center justify-between mb-3">
            {step > 1 ? (
              <IconButton
                icon={<Ionicons name="chevron-back" size={22} color={Colors.neutral[900]} />}
                onPress={handleBack}
                accessibilityLabel="Go back"
                variant="ghost"
              />
            ) : (
              <View className="w-10" />
            )}

            <View className="items-center">
              <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold">
                {STEP_LABELS[step]}
              </Text>
              <Text className="text-caption text-neutral-400">
                Step {step} of 3
              </Text>
            </View>

            <IconButton
              icon={<Ionicons name="close" size={22} color={Colors.neutral[500]} />}
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
              <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold mb-1">
                What kind of bill?
              </Text>
              <Text className="text-body text-neutral-500 dark:text-neutral-400 mb-5">
                Pick the category that best describes it.
              </Text>

              {presetsLoading ? (
                <View className="items-center py-8">
                  <Text className="text-body text-neutral-400">Loading categories…</Text>
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
                <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold mb-1">
                  Bill details
                </Text>
                {selectedPreset && (
                  <Text className="text-body text-neutral-500 dark:text-neutral-400">
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
                    placeholder="e.g. Jio Fiber, Swiggy One"
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
                    placeholder="e.g. Reliance Jio"
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
                      <Text className="text-body text-neutral-500 font-medium">₹</Text>
                    }
                  />
                )}
              />

              <View>
                <Text className="text-label text-neutral-700 dark:text-neutral-300 font-medium mb-2">
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
                      onChangeText={(t) => onChange(parseInt(t) || undefined)}
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
                        onChangeText={(t) => onChange(parseInt(t) || undefined)}
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
                        onChangeText={(t) => onChange(parseFloat(t) || undefined)}
                        value={value != null ? String(value) : ""}
                        leadingIcon={
                          <Text className="text-body text-neutral-500 font-medium">₹</Text>
                        }
                        hint="Send a reminder when balance drops below this"
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
                <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold mb-1">
                  How often?
                </Text>
                <Text className="text-body text-neutral-500 dark:text-neutral-400">
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
                      repeatKind === opt.value ? "bg-accent-50 dark:bg-accent-950" : ""
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text
                      className={`text-body ${
                        repeatKind === opt.value
                          ? "text-accent-600 dark:text-accent-400 font-semibold"
                          : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {repeatKind === opt.value && (
                      <Ionicons name="checkmark" size={18} color={Colors.accent[500]} />
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
                      onChangeText={(t) => onChange(parseInt(t) || undefined)}
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
                      onChangeText={(t) => onChange(parseInt(t) || undefined)}
                      value={value != null ? String(value) : ""}
                      error={errors.due_day_offset?.message}
                      hint="Enter 0 to use end-of-cycle (last day)"
                    />
                  )}
                />
              )}

              {/* Reminder note */}
              <View className="bg-neutral-100 dark:bg-neutral-800 rounded-card p-4 flex-row gap-2">
                <Ionicons name="notifications-outline" size={18} color={Colors.neutral[400]} />
                <Text className="text-caption text-neutral-500 dark:text-neutral-400 flex-1 leading-5">
                  We'll create default reminders: 3 days before and on the due date. You can customise them later from the bill details.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom action bar ────────────────────────────────────── */}
        <Divider />
        <View className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950">
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
              onPress={handleSubmit(onSubmit)}
              loading={submitting}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
