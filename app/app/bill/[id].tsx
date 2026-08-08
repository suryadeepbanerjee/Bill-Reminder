import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useBill, useUpdateBill }         from "../../hooks/useBills";
import { useDeleteBill }                 from "../../hooks/useBills";
import { useBillOccurrences } from "../../hooks/useOccurrences";
import { useReminderRules, useToggleReminderRule } from "../../hooks/useReminders";
import {
  useBillNotificationPreference,
  useSetBillNotificationPreference,
} from "../../hooks/useNotificationPrefs";
import { useNotificationPermission } from "../../hooks/useNotificationPermission";
import { useAuthStore }       from "../../stores/auth-store";
import { useHouseholdStore }  from "../../stores/household-store";
import { savePendingRoute }   from "../../lib/pending-route";

import { Header }          from "../../components/ui/Header";
import { Surface }         from "../../components/ui/Surface";
import { Divider }         from "../../components/ui/Divider";
import { Button }          from "../../components/ui/Button";
import { IconButton }      from "../../components/ui/IconButton";
import { Modal }           from "../../components/ui/Modal";
import { TextInput }       from "../../components/ui/TextInput";
import { NumericInput }    from "../../components/ui/NumericInput";
import { AlertBadge }      from "../../components/ui/AlertBadge";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { DateAnchorPicker, buildAnchorDate } from "../../components/ui/DateAnchorPicker";
import { RecurrencePreview } from "../../components/bills/RecurrencePreview";
import { ErrorView }       from "../../components/ui/ErrorView";
import { Switch }          from "../../components/ui/Switch";
import { BillStateChip }   from "../../components/bills/BillStateChip";
import { CategoryIconBadge } from "../../components/bills/CategoryPill";
import { MarkPaidModal, MarkPaidTarget } from "../../components/bills/MarkPaidModal";
import { DeleteTransactionModal, DeleteTransactionTarget } from "../../components/bills/DeleteTransactionModal";

import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  formatOverdueLabel,
  formatRepeatKind,
  formatBehaviorType,
} from "@shared/utils/format";
import { Colors }                         from "../../lib/theme";
import { humanize }                       from "@shared/utils/errors";
import { canEditBills }                   from "@shared/utils/roles";
import { updateBillSchema, UpdateBillFormData, DUE_DATE_YEAR_MIN, DUE_DATE_YEAR_MAX } from "@shared/schemas";
import type { Bill, BillOccurrence, BillNotificationPreference, BillReminderRule } from "@shared/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActionableState(state: string): boolean {
  return ["due_today", "overdue", "expected_payment", "generated"].includes(state);
}

function getReminderAnchorLabel(anchor: string): string {
  if (anchor === "due_date")         return "Due date";
  if (anchor === "expected_payment") return "Expected payment date";
  return "Generation date";
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── Bill type options ────────────────────────────────────────────────────────

const BEHAVIOR_OPTIONS = [
  { value: "fixed_due_date" as const, label: "Fixed due date", icon: "calendar-outline" as const },
  { value: "prepaid_validity" as const, label: "Prepaid / Validity", icon: "time-outline" as const },
  { value: "wallet_balance" as const, label: "Wallet / Balance", icon: "wallet-outline" as const },
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
  const [nextDueDate, setNextDueDate] = useState<string | null>(bill.next_due_date ?? null);
  const { mutateAsync: updateBill, isPending } = useUpdateBill();

  // Sync the next-due selection every time the sheet opens (it stays mounted).
  useEffect(() => {
    if (visible) setNextDueDate(bill.next_due_date ?? null);
  }, [visible, bill.next_due_date]);

  const initialAnchor = useMemo(() => {
    // Prefer the stored anchor_date; fall back to bill's creation date (not today)
    // so the default shown is meaningful rather than arbitrary.
    const src = bill.anchor_date
      ? new Date(bill.anchor_date + "T00:00:00")
      : new Date(bill.created_at);
    return {
      month: src.getMonth() + 1,
      day:   src.getDate(),
      year:  src.getFullYear(),
    };
  }, [bill.anchor_date, bill.created_at]);

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
      anchor_month:       initialAnchor.month,
      anchor_day:         initialAnchor.day,
      anchor_year:        initialAnchor.year,
    },
    mode: "onBlur",
  });

  const anchorMonthVal = watch("anchor_month") ?? initialAnchor.month;
  const anchorDayVal   = watch("anchor_day")   ?? initialAnchor.day;
  const anchorYearVal  = watch("anchor_year")   ?? initialAnchor.year;

  const handleAnchorMonthChange = useCallback((m: number) => {
    setValue("anchor_month", m, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const handleAnchorDayChange = useCallback((d: number) => {
    setValue("anchor_day", d, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const handleAnchorYearChange = useCallback((y: number) => {
    setValue("anchor_year", y, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const behaviorType  = watch("behavior_type");
  const repeatKind    = watch("repeat_kind");
  const needsInterval = ["every_x_days", "every_x_weeks", "every_x_months"].includes(repeatKind as string);
  const isPrepaid     = behaviorType === "prepaid_validity" || behaviorType === "wallet_balance";
  const repeatIntervalVal = watch("repeat_interval") ?? null;
  const anchorDateStr = buildAnchorDate(anchorMonthVal, anchorDayVal, anchorYearVal);

  // A next-due selection is tied to the anchor/schedule — when the user edits
  // them, drop a previously selected date so a stale one is never submitted.
  const scheduleChanged =
    behaviorType !== bill.behavior_type ||
    repeatKind   !== bill.repeat_kind ||
    repeatIntervalVal !== (bill.repeat_interval ?? null) ||
    anchorDateStr !== buildAnchorDate(initialAnchor.month, initialAnchor.day, initialAnchor.year);

  useEffect(() => {
    if (scheduleChanged) setNextDueDate(null);
  }, [scheduleChanged]);

  const repeatOptions = useMemo(() => {
    if (behaviorType === "fixed_due_date") {
      return [
        { value: "monthly" as const, label: "Every month" },
        { value: "yearly"  as const, label: "Every year" },
        { value: "none"    as const, label: "One-time (no repeat)" },
      ];
    }
    return [
      { value: "monthly"        as const, label: "Every month",          needsInterval: false },
      { value: "yearly"         as const, label: "Every year",           needsInterval: false },
      { value: "every_x_days"   as const, label: "Every X days",         needsInterval: true  },
      { value: "every_x_weeks"  as const, label: "Every X weeks",        needsInterval: true  },
      { value: "every_x_months" as const, label: "Every X months",       needsInterval: true  },
      { value: "none"           as const, label: "One-time (no repeat)", needsInterval: false },
    ];
  }, [behaviorType]);

  const onSubmit = async (data: UpdateBillFormData) => {
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

      // Strip non-DB fields (anchor_month/day/year are form-only)
      const { anchor_month: _am, anchor_day: _ad, anchor_year: _ay, ...dbPayload } = payload as any;

      await updateBill({ id: bill.id, input: dbPayload });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      {/* 85vh inner wrapper would overflow the sheet (handle bar + bottom
          inset are added by the Modal), pushing the action bar off-screen. */}
      <View className="max-h-[75vh]">
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
          contentContainerStyle={{ paddingBottom: 20 }}
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

            {/* Repeat frequency */}
            <View>
              <Text className="text-label text-primary font-medium mb-2">
                Repeat frequency
              </Text>
              {repeatOptions.map((opt) => (
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
                  <NumericInput
                    label={`Every how many ${
                      repeatKind === "every_x_days"   ? "days" :
                      repeatKind === "every_x_weeks"  ? "weeks" : "months"
                    }?`}
                    placeholder="e.g. 2"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onBlur={onBlur}
                    onChange={onChange}
                    value={value ?? undefined}
                    error={errors.repeat_interval?.message}
                  />
                )}
              />
            )}

            {/* Fixed due date: monthly → due_day_offset; yearly → DateAnchorPicker */}
            {behaviorType === "fixed_due_date" && repeatKind === "monthly" && (
              <Controller
                control={control}
                name="due_day_offset"
                render={({ field: { onChange, onBlur, value } }) => (
                  <NumericInput
                    label="Due on day (of month)"
                    placeholder="e.g. 5"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onBlur={onBlur}
                    onChange={onChange}
                    value={value ?? undefined}
                    error={errors.due_day_offset?.message}
                    hint="Enter 0 for end-of-cycle (last day)"
                  />
                )}
              />
            )}

            {behaviorType === "fixed_due_date" && repeatKind === "yearly" && (
              <DateAnchorPicker
                month={anchorMonthVal}
                day={anchorDayVal}
                year={anchorYearVal}
                onMonthChange={handleAnchorMonthChange}
                onDayChange={handleAnchorDayChange}
                onYearChange={handleAnchorYearChange}
                showYear={false}
                dateLabel="Due date"
                errors={{
                  month: errors.anchor_month?.message,
                  day:   errors.anchor_day?.message,
                  year:  errors.anchor_year?.message,
                }}
              />
            )}

            {behaviorType === "fixed_due_date" && repeatKind === "none" && (
              <DateAnchorPicker
                month={anchorMonthVal}
                day={anchorDayVal}
                year={anchorYearVal}
                onMonthChange={handleAnchorMonthChange}
                onDayChange={handleAnchorDayChange}
                onYearChange={handleAnchorYearChange}
                showYear={true}
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

            {/* Prepaid/wallet: monthly/yearly/none → DateAnchorPicker */}
            {isPrepaid && !needsInterval && (
              <DateAnchorPicker
                month={anchorMonthVal}
                day={anchorDayVal}
                year={anchorYearVal}
                onMonthChange={handleAnchorMonthChange}
                onDayChange={handleAnchorDayChange}
                onYearChange={handleAnchorYearChange}
                showYear={repeatKind === "none"}
                dateLabel={repeatKind === "none" ? "Due date" : "Last payment date"}
                order={repeatKind === "none" ? "DMY" : "MDY"}
                yearMin={repeatKind === "none" ? DUE_DATE_YEAR_MIN : undefined}
                yearMax={repeatKind === "none" ? DUE_DATE_YEAR_MAX : undefined}
                errors={{
                  month: errors.anchor_month?.message,
                  day:   errors.anchor_day?.message,
                  year:  errors.anchor_year?.message,
                }}
              />
            )}

            {/* Prepaid/wallet: every_x_* → DateAnchorPicker (anchor_date = start) */}
            {isPrepaid && needsInterval && (
              <DateAnchorPicker
                month={anchorMonthVal}
                day={anchorDayVal}
                year={anchorYearVal}
                onMonthChange={handleAnchorMonthChange}
                onDayChange={handleAnchorDayChange}
                onYearChange={handleAnchorYearChange}
                showYear={true}
                dateLabel="Last payment date"
                errors={{
                  month: errors.anchor_month?.message,
                  day:   errors.anchor_day?.message,
                  year:  errors.anchor_year?.message,
                }}
              />
            )}

            {/* Live preview for prepaid/wallet */}
            {isPrepaid && (
              <RecurrencePreview
                behaviorType={behaviorType}
                repeatKind={repeatKind as string}
                repeatInterval={needsInterval ? repeatIntervalVal ?? undefined : undefined}
                dueDayOffset={undefined}
                anchorDate={anchorDateStr || undefined}
                value={nextDueDate}
                onChange={setNextDueDate}
              />
            )}
          </View>
        </ScrollView>

        {/* Action bar */}
        <Divider />
        <View className="flex-row gap-3 px-4 pt-3 pb-4">
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

// ── Reminder rule row ─────────────────────────────────────────────────────────

function ReminderRuleRow({
  rule,
  billId,
  notificationsLocked,
}: {
  rule: BillReminderRule;
  billId: string;
  notificationsLocked: boolean;
}) {
  const { mutate: toggle, isPending } = useToggleReminderRule();

  const offsetLabel = rule.offset_days === 0
    ? "On the day"
    : rule.offset_days < 0
    ? `${Math.abs(rule.offset_days)} days before`
    : `${rule.offset_days} days after`;

  const channelIcon: keyof typeof Ionicons.glyphMap =
    rule.channel === "push"  ? "notifications-outline" :
    rule.channel === "email" ? "mail-outline"          : "sync-outline";

  // Push delivery (and "both") needs device notification permission; email
  // reminders keep working without it.
  const pushChannel = rule.channel === "push" || rule.channel === "both";
  const locked = notificationsLocked && pushChannel;

  const onToggle = () => toggle({ id: rule.id, enabled: !rule.enabled, billId });

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
      {locked ? (
        <View className="items-end gap-1">
          <Switch
            value={rule.enabled}
            onValueChange={onToggle}
            disabled
            accessibilityLabel={`${offsetLabel} reminder blocked — enable notifications in settings`}
          />
          <Text className="text-[10px] text-secondary">
            Enable notifications to turn on
          </Text>
        </View>
      ) : (
        <Switch
          value={rule.enabled}
          onValueChange={onToggle}
          disabled={isPending}
          accessibilityLabel={`${offsetLabel} reminder ${rule.enabled ? "on" : "off"}`}
        />
      )}
    </View>
  );
}

// ── Occurrence history row ────────────────────────────────────────────────────

function OccurrenceRow({ occurrence, onDelete, canEdit }: { occurrence: BillOccurrence, onDelete: () => void, canEdit?: boolean }) {
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
      <View style={{ marginTop: 2 }}>
        <BillStateChip state={occurrence.state} />
      </View>
      
      {isPaid && canEdit && (
        <IconButton 
          icon={<Ionicons name="trash-outline" size={16} color="#EF4444" />}
          size="sm" 
          variant="danger"
          accessibilityLabel="Delete transaction"
          onPress={onDelete} 
        />
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<DeleteTransactionTarget | null>(null);
  const [showEditBill, setShowEditBill]   = useState(false);

  const activeHousehold = useHouseholdStore((s) => s.activeHousehold);
  const canEdit = canEditBills(activeHousehold?.member.role);

  const { user, isLoading: authLoading } = useAuthStore();
  const { data: bill, isLoading, isError, error, refetch } = useBill(id, Boolean(user));
  const { data: occurrences = [] } = useBillOccurrences(id);
  const { data: reminderRules = [] } = useReminderRules(id);
  const { data: myPref } = useBillNotificationPreference(id, user?.id);
  const { mutateAsync: setPref, isPending: prefPending } = useSetBillNotificationPreference();
  const { mutateAsync: deleteBill, isPending: isDeleting } = useDeleteBill();
  const { granted: notificationsGranted, refresh: refreshNotifications } = useNotificationPermission();

  // Current (most actionable) occurrence — scan EARLIEST cycle first so a
  // materialized overdue chain (explicit past next-due selection) surfaces the
  // overdue row, while the default state has only the next future row anyway.
  const currentOccurrence = useMemo(
    () =>
      [...occurrences]
        .sort((a, b) => (a.cycle_start ?? "").localeCompare(b.cycle_start ?? ""))
        .find((o) =>
          ["due_today", "overdue", "expected_payment", "generated", "upcoming"].includes(o.state)
        ) ?? occurrences[0],
    [occurrences]
  );

  const paidOccurrences = useMemo(
    () => occurrences.filter(o => o.state === "paid"),
    [occurrences]
  );

  const handleSetPref = useCallback(
    async (patch: Partial<Pick<BillNotificationPreference, "push_enabled" | "email_enabled">>) => {
      if (!id || !user?.id) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await setPref({ billId: id, userId: user.id, patch });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Could not update", humanize(e));
      }
    },
    [id, user?.id, setPref]
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

  const handleEnableNotifications = useCallback(async () => {
    try {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        refreshNotifications();
      } else {
        Linking.openSettings();
      }
    } catch {
      Linking.openSettings();
    }
  }, [refreshNotifications]);

  // Deep link opened while signed out — offer sign-in and return here after.

  if (authLoading) {    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <LoadingSkeleton variant="detail" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <View className="w-14 h-14 rounded-full bg-accent/10 items-center justify-center">
            <Ionicons name="log-in-outline" size={28} color={Colors.accent[500]} />
          </View>
          <Text className="text-label text-primary font-semibold text-center">
            Sign in required
          </Text>
          <Text className="text-body text-secondary text-center">
            You need to sign in to view this bill.
          </Text>
          <Button
            title="Sign in"
            variant="accent"
            onPress={() => {
              savePendingRoute(`/bill/${id}`);
              router.replace("/(auth)/sign-in");
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <LoadingSkeleton variant="detail" />
      </SafeAreaView>
    );
  }

  if (isError) {
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

  if (!bill) {
    // Deep link to a bill that doesn't exist (deleted or bad link).
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <Header title="Bill details" showBack />
        <ErrorView message="This bill could not be found. It may have been deleted or the link may be incorrect." />
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
              onPress={() => {
                if (activeHousehold?.member.role === "member") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert("Permission Denied", "You are a member of this group, you cannot perform this action.");
                  return;
                }
                setShowEditBill(true);
              }}
              accessibilityLabel="Edit bill"
              variant="ghost"
            />
            <IconButton
              icon={<Ionicons name="trash-outline" size={20} className="text-error" />}
              onPress={() => {
                if (activeHousehold?.member.role === "member") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert("Permission Denied", "You are a member of this group, you cannot perform this action.");
                  return;
                }
                handleDelete();
              }}
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
        {canMarkPaid && canEdit && (
          <View className="px-4 mb-4">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMarkPaidTarget({
                  occurrence: currentOccurrence,
                  billTitle: bill.title,
                  amountExpected: currentOccurrence.amount ?? bill.amount_expected ?? null,
                  behaviorType: bill.behavior_type,
                });
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
              bill.due_day_offset != null && bill.due_day_offset > 0
                ? { label: "Due day", value: `${bill.due_day_offset}${ordinalSuffix(bill.due_day_offset)} of month` }
                : null,
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
            <>
              {!notificationsGranted &&
                reminderRules.some((r) => r.channel === "push" || r.channel === "both") && (
                  <View className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card px-4 py-3 mb-2">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="notifications-off" size={16} className="text-secondary" />
                      <Text className="text-label text-primary font-medium flex-1">
                        Notifications are off
                      </Text>
                    </View>
                    <Text className="text-caption text-secondary mt-1 mb-2.5">
                      Push reminders are blocked. Enable notifications from your device
                      settings to turn them on.
                    </Text>
                    <Button
                      title="Enable notifications"
                      variant="secondary"
                      size="sm"
                      icon={<Ionicons name="settings-outline" size={15} className="text-primary" />}
                      guardKey="enable-notifications"
                      onPress={handleEnableNotifications}
                    />
                  </View>
                )}
              <Surface level="resting" bordered rounded="card">
                {reminderRules.map((rule, idx) => (
                  <View key={rule.id}>
                    <ReminderRuleRow
                      rule={rule}
                      billId={id!}
                      notificationsLocked={!notificationsGranted}
                    />
                    {idx < reminderRules.length - 1 && <Divider inset={16} />}
                  </View>
                ))}
              </Surface>
            </>
          )}
        </View>

        {/* ── My notifications ────────────────────────────────────────── */}
        <View className="px-4 mb-4">
          <Text className="text-caption text-secondary font-medium mb-1.5">
            My notifications for this bill
          </Text>
          <Surface level="resting" bordered rounded="card" className="overflow-hidden">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="w-8 h-8 rounded-input bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                <Ionicons name="notifications-outline" size={16} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-label text-primary font-medium">Push notifications</Text>
                <Text className="text-caption text-secondary mt-0.5">
                  Get a push when this bill is due or overdue
                </Text>
              </View>
              <Switch
                value={myPref?.push_enabled ?? false}
                onValueChange={(v) => handleSetPref({ push_enabled: v })}
                disabled={prefPending || !canEdit || !user?.id}
                accessibilityLabel="Push notifications for this bill"
              />
            </View>
            {canEdit ? (
              <Divider inset={16} />
            ) : (
              <View className="px-4 pb-3 -mt-1">
                <Text className="text-[10px] text-secondary">
                  Members can't change notification settings — they're always off
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="w-8 h-8 rounded-input bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                <Ionicons name="mail-outline" size={16} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-label text-primary font-medium">Email reminders</Text>
                <Text className="text-caption text-secondary mt-0.5">
                  Get an email when this bill is due or overdue
                </Text>
              </View>
              <Switch
                value={myPref?.email_enabled ?? false}
                onValueChange={(v) => handleSetPref({ email_enabled: v })}
                disabled={prefPending || !canEdit}
                accessibilityLabel="Email reminders for this bill"
              />
            </View>
          </Surface>
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
                  <OccurrenceRow 
                    occurrence={o} 
                    canEdit={canEdit}
                    onDelete={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setDeleteTransactionTarget({
                        occurrence: o,
                        bill: bill!,
                        isOldest: idx === arr.length - 1,
                        hasOlder: idx < arr.length - 1,
                        previousCycleStart: idx < arr.length - 1 ? arr[idx + 1].cycle_start : null,
                      });
                    }}
                  />
                  {idx < arr.length - 1 && <Divider inset={16} />}
                </View>
              ))}
            </Surface>
          </View>
        )}
      </ScrollView>

      {/* ── Mark Paid sheet ────────────────────────────────────────────── */}
      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() => {
          // Optimistic: the occurrence list will refresh via RQ
        }}
      />
      
      {/* ── Delete Transaction modal ────────────────────────────────────── */}
      <DeleteTransactionModal
        target={deleteTransactionTarget}
        onClose={() => setDeleteTransactionTarget(null)}
        onSuccess={() => {
          // Optimistic update handles this
        }}
      />

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
