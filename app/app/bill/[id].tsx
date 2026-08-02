import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useBill, useUpdateBill }         from "../../hooks/useBills";
import { useDeleteBill }                 from "../../hooks/useBills";
import { useBillOccurrences, useMarkPaid } from "../../hooks/useOccurrences";
import { useReminderRules, useToggleReminderRule } from "../../hooks/useReminders";

import { Header }          from "../../components/ui/Header";
import { Surface }         from "../../components/ui/Surface";
import { Divider }         from "../../components/ui/Divider";
import { Button }          from "../../components/ui/Button";
import { IconButton }      from "../../components/ui/IconButton";
import { Modal }           from "../../components/ui/Modal";
import { TextInput }       from "../../components/ui/TextInput";
import { AlertBadge }      from "../../components/ui/AlertBadge";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { ErrorView }       from "../../components/ui/ErrorView";
import { Switch }          from "../../components/ui/Switch";
import { BillStateChip }   from "../../components/bills/BillStateChip";
import { CategoryIconBadge } from "../../components/bills/CategoryPill";

import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  formatOverdueLabel,
  formatRepeatKind,
  formatBehaviorType,
} from "../../lib/utils";
import { Colors }                         from "../../lib/theme";
import { humanize }                       from "../../lib/errors";
import { updateBillSchema, UpdateBillFormData } from "../../schemas/bill";
import type { Bill, BillOccurrence, BillReminderRule } from "../../lib/supabase/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActionableState(state: string): boolean {
  return ["due_today", "overdue", "expected_payment", "generated"].includes(state);
}

function getReminderAnchorLabel(anchor: string): string {
  if (anchor === "due_date")         return "Due date";
  if (anchor === "expected_payment") return "Expected payment date";
  return "Generation date";
}

// ── Bill type options ────────────────────────────────────────────────────────

const BEHAVIOR_OPTIONS = [
  { value: "fixed_due_date" as const, label: "Fixed due date", icon: "calendar-outline" as const },
  { value: "prepaid_validity" as const, label: "Prepaid / Validity", icon: "time-outline" as const },
  { value: "wallet_balance" as const, label: "Wallet / Balance", icon: "wallet-outline" as const },
];

const REPEAT_OPTIONS = [
  { value: "monthly" as const,        label: "Monthly",              needsInterval: false },
  { value: "yearly" as const,         label: "Yearly",               needsInterval: false },
  { value: "every_x_days" as const,   label: "Every X days",         needsInterval: true  },
  { value: "every_x_weeks" as const,  label: "Every X weeks",        needsInterval: true  },
  { value: "every_x_months" as const, label: "Every X months",       needsInterval: true  },
  { value: "none" as const,           label: "One-time (no repeat)", needsInterval: false },
];

// ── Edit Bill sheet ──────────────────────────────────────────────────────────

interface EditBillSheetProps {
  visible: boolean;
  bill:    Bill;
  onClose: () => void;
  onSuccess: () => void;
}

function EditBillSheet({ visible, bill, onClose, onSuccess }: EditBillSheetProps) {
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: updateBill, isPending } = useUpdateBill();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateBillFormData>({
    resolver: zodResolver(updateBillSchema),
    defaultValues: {
      title:              bill.title,
      provider_name:      bill.provider_name ?? undefined,
      amount_expected:    bill.amount_expected ?? undefined,
      behavior_type:      bill.behavior_type,
      repeat_kind:        bill.repeat_kind,
      repeat_interval:    bill.repeat_interval ?? undefined,
      due_day_offset:     bill.due_day_offset ?? undefined,
      validity_days:      bill.validity_days ?? undefined,
      check_interval_days: bill.check_interval_days ?? undefined,
      minimum_balance:    bill.minimum_balance ?? undefined,
    },
    mode: "onBlur",
  });

  const behaviorType  = watch("behavior_type");
  const repeatKind    = watch("repeat_kind");
  const needsInterval = ["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind as string);

  const onSubmit = async (data: UpdateBillFormData) => {
    setError(null);
    try {
      // Null out fields not relevant to the selected behavior type
      const payload: UpdateBillFormData = {
        ...data,
        validity_days:       data.behavior_type === "prepaid_validity" ? (data.validity_days       ?? null) : null,
        check_interval_days: data.behavior_type === "wallet_balance"   ? (data.check_interval_days ?? null) : null,
        minimum_balance:     data.behavior_type === "wallet_balance"   ? (data.minimum_balance     ?? null) : null,
        due_day_offset:      data.behavior_type === "fixed_due_date"   ? (data.due_day_offset      ?? null) : null,
      };

      await updateBill({ id: bill.id, input: payload as any });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View className="max-h-[85vh]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-title text-primary font-semibold">
            Edit bill
          </Text>
          <IconButton
            icon={<Ionicons name="close" size={20} className="text-primary" />}
            onPress={onClose}
            accessibilityLabel="Close"
            variant="ghost"
          />
        </View>

        <Divider />

        {/* Scrollable form */}
        <ScrollView
          className="px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View className="mb-4">
              <AlertBadge message={error} variant="error" />
            </View>
          )}

          <View className="gap-4">
            {/* Bill name */}
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Bill name"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value ?? ""}
                  error={errors.title?.message}
                  maxCharacters={120}
                />
              )}
            />

            {/* Provider */}
            <Controller
              control={control}
              name="provider_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Provider / Vendor"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value ?? ""}
                  maxCharacters={80}
                />
              )}
            />

            {/* Amount */}
            <Controller
              control={control}
              name="amount_expected"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Expected amount"
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

            {/* Bill type */}
            <View>
              <Text className="text-label text-primary font-medium mb-2">
                Bill type
              </Text>
              {BEHAVIOR_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setValue("behavior_type", opt.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: behaviorType === opt.value }}
                  className={`flex-row items-center gap-3 p-3 rounded-card border mb-2 ${
                    behaviorType === opt.value
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface"
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <View
                    className={`w-8 h-8 rounded-input items-center justify-center ${
                      behaviorType === opt.value
                        ? "bg-accent"
                        : "bg-surface border border-border"
                    }`}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      className={behaviorType === opt.value ? "text-accent-text" : "text-primary"}
                    />
                  </View>
                  <Text
                    className={`text-body flex-1 ${
                      behaviorType === opt.value
                        ? "text-accent font-semibold"
                        : "text-primary"
                    }`}
                  >
                    {opt.label}
                  </Text>
                  {behaviorType === opt.value && (
                    <Ionicons name="checkmark-circle" size={18} className="text-accent" />
                  )}
                </Pressable>
              ))}
            </View>

            {/* Conditional: prepaid validity days */}
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
                  />
                )}
              />
            )}

            {/* Conditional: wallet fields */}
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
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="minimum_balance"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Alert below balance"
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

            {/* Repeat frequency */}
            <View>
              <Text className="text-label text-primary font-medium mb-2">
                Repeat frequency
              </Text>
              {REPEAT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setValue("repeat_kind", opt.value);
                  }}
                  className={`flex-row items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 ${
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

            {/* Conditional: repeat interval */}
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

            {/* Conditional: due day offset for fixed due date */}
            {behaviorType === "fixed_due_date" && (
              <Controller
                control={control}
                name="due_day_offset"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    label="Due on day (of month)"
                    placeholder="e.g. 5"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onBlur={onBlur}
                    onChangeText={(t) => {
                      const parsed = parseInt(t);
                      onChange(isNaN(parsed) ? undefined : parsed);
                    }}
                    value={value != null ? String(value) : ""}
                    error={errors.due_day_offset?.message}
                    hint="Enter 0 for end-of-cycle (last day)"
                  />
                )}
              />
            )}
          </View>
        </ScrollView>

        {/* Action bar */}
        <Divider />
        <View className="flex-row gap-3 px-4 py-3">
          <View className="flex-1">
            <Button title="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View className="flex-1">
            <Button
              title="Save changes"
              variant="accent"
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Mark Paid sheet ───────────────────────────────────────────────────────────

interface MarkPaidSheetProps {
  visible:       boolean;
  occurrence:    BillOccurrence;
  defaultAmount: number;
  onClose:       () => void;
  onSuccess:     () => void;
}

function MarkPaidSheet({
  visible,
  occurrence,
  defaultAmount,
  onClose,
  onSuccess,
}: MarkPaidSheetProps) {
  const [amount, setAmount]   = useState(String(defaultAmount || ""));
  const [notes, setNotes]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const { mutateAsync, isPending } = useMarkPaid();

  const handleMarkPaid = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    try {
      await mutateAsync({
        occurrence_id:  occurrence.id,
        paid_amount:    parsedAmount,
        paid_at:        new Date().toISOString(),
        payment_notes:  notes.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View className="px-4 pt-4 pb-6 gap-4">
        <Text className="text-title text-primary font-semibold">
          Mark as paid
        </Text>

        {error && <AlertBadge message={error} variant="error" />}

        <TextInput
          label="Amount paid"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          returnKeyType="next"
          autoFocus
          leadingIcon={
            <Text className="text-body text-secondary font-medium">₹</Text>
          }
          hint="Pre-filled with the expected amount"
        />

        <TextInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Payment reference, transaction ID…"
          multiline
          numberOfLines={2}
          maxCharacters={1000}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button title="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View className="flex-1">
            <Button
              title="Confirm payment"
              variant="accent"
              onPress={handleMarkPaid}
              loading={isPending}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Reminder rule row ─────────────────────────────────────────────────────────

function ReminderRuleRow({ rule, billId }: { rule: BillReminderRule; billId: string }) {
  const { mutate: toggle, isPending } = useToggleReminderRule();

  const offsetLabel = rule.offset_days === 0
    ? "On the day"
    : rule.offset_days < 0
    ? `${Math.abs(rule.offset_days)} days before`
    : `${rule.offset_days} days after`;

  const channelIcon: keyof typeof Ionicons.glyphMap =
    rule.channel === "push"  ? "notifications-outline" :
    rule.channel === "email" ? "mail-outline"          : "sync-outline";

  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="w-8 h-8 rounded-input bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
        <Ionicons name={channelIcon} size={16} className="text-primary" />
      </View>
      <View className="flex-1">
        <Text className="text-label text-primary font-medium">
          {offsetLabel}
        </Text>
        <Text className="text-caption text-secondary mt-0.5">
          {getReminderAnchorLabel(rule.anchor)} · {rule.channel === "both" ? "Push + Email" : rule.channel}
        </Text>
      </View>
      <Switch
        value={rule.enabled}
        onValueChange={(enabled) =>
          toggle({ id: rule.id, enabled, billId })
        }
        disabled={isPending}
        accessibilityLabel={`${offsetLabel} reminder ${rule.enabled ? "on" : "off"}`}
      />
    </View>
  );
}

// ── Occurrence history row ────────────────────────────────────────────────────

function OccurrenceRow({ occurrence }: { occurrence: BillOccurrence }) {
  const isPaid = occurrence.state === "paid";

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View
        className={`w-2 h-2 rounded-full ${
          isPaid ? "bg-success" : "bg-neutral-300 dark:bg-neutral-600"
        }`}
      />
      <View className="flex-1">
        <Text className="text-label text-primary">
          {formatDate(occurrence.cycle_start)}
        </Text>
        {occurrence.paid_at && (
          <Text className="text-caption text-secondary mt-0.5">
            Paid {formatDate(occurrence.paid_at)}
            {occurrence.payment_notes ? ` · ${occurrence.payment_notes}` : ""}
          </Text>
        )}
      </View>
      {occurrence.paid_amount != null ? (
        <Text
          className="text-label text-primary font-medium"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatCurrency(occurrence.paid_amount)}
        </Text>
      ) : null}
      <BillStateChip state={occurrence.state} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showEditBill, setShowEditBill]   = useState(false);

  const { data: bill, isLoading, isError, error, refetch } = useBill(id);
  const { data: occurrences = [] } = useBillOccurrences(id);
  const { data: reminderRules = [] } = useReminderRules(id);
  const { mutateAsync: deleteBill, isPending: isDeleting } = useDeleteBill();

  // Current (most actionable) occurrence
  const currentOccurrence = useMemo(
    () => occurrences.find((o) =>
      ["due_today", "overdue", "expected_payment", "generated", "upcoming"].includes(o.state)
    ) ?? occurrences[0],
    [occurrences]
  );

  const paidOccurrences = useMemo(
    () => occurrences.filter(o => o.state === "paid"),
    [occurrences]
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete bill",
      `Are you sure you want to delete "${bill?.title}"? All history will be preserved but no new occurrences will be generated.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text:    "Delete",
          style:   "destructive",
          onPress: async () => {
            try {
              await deleteBill(id!);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              router.back();
            } catch (e: any) {
              Alert.alert("Error", "Failed to delete bill. Please try again.");
            }
          },
        },
      ]
    );
  }, [bill?.title, deleteBill, id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <LoadingSkeleton variant="detail" />
      </SafeAreaView>
    );
  }

  if (isError || !bill) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <ErrorView
          message="Failed to load bill."
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const cat              = bill.categories!;
  const displayAmount    = currentOccurrence?.amount ?? bill.amount_expected;
  const dueDate          = currentOccurrence?.due_date ?? currentOccurrence?.expected_payment_date;
  const dueDateLabel     = dueDate ? formatRelativeDate(dueDate) : null;
  const canMarkPaid      = currentOccurrence && isActionableState(currentOccurrence.state);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Header
        title={bill.title}
        showBack
        rightAction={
          <View className="flex-row gap-3">
            <IconButton
              icon={<Ionicons name="create-outline" size={20} className="text-primary" />}
              onPress={() => setShowEditBill(true)}
              accessibilityLabel="Edit bill"
              variant="ghost"
            />
            <IconButton
              icon={<Ionicons name="trash-outline" size={20} className="text-error" />}
              onPress={handleDelete}
              accessibilityLabel="Delete bill"
              variant="danger"
            />
          </View>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ───────────────────────────────────────────────── */}
        <View className="p-4">
          <Surface level="resting" bordered rounded="card" className="p-5">
            <View className="items-center gap-3">
              <CategoryIconBadge icon={cat.icon} color={cat.color} size={56} />

              <View className="items-center">
                <Text className="text-caption text-secondary mb-0.5">
                  {cat.name}
                  {bill.provider_name ? ` · ${bill.provider_name}` : ""}
                </Text>
                <Text className="text-title text-primary font-semibold text-center">
                  {bill.title}
                </Text>
              </View>

              {displayAmount != null ? (
                <Text
                  className="text-amount-lg text-primary font-bold"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatCurrency(displayAmount, bill.currency)}
                </Text>
              ) : (
                <Text className="text-amount-lg text-secondary">Variable</Text>
              )}

              {currentOccurrence && (
                <View className="items-center gap-1.5">
                  <BillStateChip
                    state={currentOccurrence.state}
                    label={
                      ["overdue","due_today"].includes(currentOccurrence.state) && dueDate
                        ? formatOverdueLabel(dueDate)
                        : dueDateLabel ?? undefined
                    }
                  />
                  {dueDate && !["overdue","due_today"].includes(currentOccurrence.state) && (
                    <Text className="text-caption text-secondary">
                      {formatDate(dueDate)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </Surface>
        </View>

        {/* ── Mark Paid CTA ───────────────────────────────────────────── */}
        {canMarkPaid && (
          <View className="px-4 mb-4">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowMarkPaid(true);
              }}
              className="bg-success rounded-input flex-row items-center justify-center gap-2 py-4"
              style={({ pressed }) => ({
                opacity:   pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Mark bill as paid"
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text className="text-label text-white font-semibold">
                Mark as paid
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Bill details ────────────────────────────────────────────── */}
        <View className="px-4 mb-4">
          <Text className="text-caption text-secondary font-medium mb-1.5">
            Details
          </Text>
          <Surface level="resting" bordered rounded="card">
            {[
              { label: "Type",       value: formatBehaviorType(bill.behavior_type) },
              { label: "Frequency",  value: formatRepeatKind(bill.repeat_kind, bill.repeat_interval) },
              bill.validity_days     ? { label: "Validity",    value: `${bill.validity_days} days`   } : null,
              bill.minimum_balance   ? { label: "Min. balance", value: formatCurrency(bill.minimum_balance) } : null,
              bill.check_interval_days ? { label: "Checked every", value: `${bill.check_interval_days} days` } : null,
            ]
              .filter(Boolean)
              .map((row, idx, arr) => (
                <View key={row!.label}>
                  <View className="flex-row items-center justify-between px-4 py-3.5">
                    <Text className="text-body text-secondary">
                      {row!.label}
                    </Text>
                    <Text className="text-body text-primary font-medium">
                      {row!.value}
                    </Text>
                  </View>
                  {idx < arr.length - 1 && <Divider inset={16} />}
                </View>
              ))}
          </Surface>
        </View>

        {/* ── Reminders ───────────────────────────────────────────────── */}
        <View className="px-4 mb-4">
          <Text className="text-caption text-secondary font-medium mb-1.5">
            Reminders
          </Text>
          {reminderRules.length === 0 ? (
            <Surface level="resting" bordered rounded="card" className="py-6 items-center">
              <Text className="text-body text-secondary">No reminders set</Text>
            </Surface>
          ) : (
            <Surface level="resting" bordered rounded="card">
              {reminderRules.map((rule, idx) => (
                <View key={rule.id}>
                  <ReminderRuleRow rule={rule} billId={id!} />
                  {idx < reminderRules.length - 1 && <Divider inset={16} />}
                </View>
              ))}
            </Surface>
          )}
        </View>

        {/* ── Payment history ─────────────────────────────────────────── */}
        {paidOccurrences.length > 0 && (
          <View className="px-4">
            <Text className="text-caption text-secondary font-medium mb-1.5">
              Payment history
            </Text>
            <Surface level="resting" bordered rounded="card">
              {paidOccurrences.slice(0, 12).map((o, idx, arr) => (
                <View key={o.id}>
                  <OccurrenceRow occurrence={o} />
                  {idx < arr.length - 1 && <Divider inset={16} />}
                </View>
              ))}
            </Surface>
          </View>
        )}
      </ScrollView>

      {/* ── Mark Paid sheet ────────────────────────────────────────────── */}
      {currentOccurrence && (
        <MarkPaidSheet
          visible={showMarkPaid}
          occurrence={currentOccurrence}
          defaultAmount={
            currentOccurrence.amount ?? bill.amount_expected ?? 0
          }
          onClose={() => setShowMarkPaid(false)}
          onSuccess={() => {
            // Optimistic: the occurrence list will refresh via RQ
          }}
        />
      )}

      {/* ── Edit Bill sheet ────────────────────────────────────────────── */}
      <EditBillSheet
        visible={showEditBill}
        bill={bill}
        onClose={() => setShowEditBill(false)}
        onSuccess={() => {
          // React Query invalidation handles refetch
        }}
      />
    </SafeAreaView>
  );
}
