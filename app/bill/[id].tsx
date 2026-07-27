import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useBill }                       from "../../hooks/useBills";
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
import type { BillOccurrence, BillReminderRule } from "../../lib/supabase/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActionableState(state: string): boolean {
  return ["due_today", "overdue", "expected_payment", "generated"].includes(state);
}

function getReminderAnchorLabel(anchor: string): string {
  if (anchor === "due_date")         return "Due date";
  if (anchor === "expected_payment") return "Expected payment date";
  return "Generation date";
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
      setError(e?.message ?? "Failed to mark as paid.");
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View className="px-4 pt-4 pb-6 gap-4">
        <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold">
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
            <Text className="text-body text-neutral-500 font-medium">₹</Text>
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
        <Ionicons name={channelIcon} size={16} color={Colors.neutral[500]} />
      </View>
      <View className="flex-1">
        <Text className="text-label text-neutral-900 dark:text-neutral-100 font-medium">
          {offsetLabel}
        </Text>
        <Text className="text-caption text-neutral-400 mt-0.5">
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
          isPaid ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
        }`}
      />
      <View className="flex-1">
        <Text className="text-label text-neutral-900 dark:text-neutral-100">
          {formatDate(occurrence.cycle_start)}
        </Text>
        {occurrence.paid_at && (
          <Text className="text-caption text-neutral-400 mt-0.5">
            Paid {formatDate(occurrence.paid_at)}
            {occurrence.payment_notes ? ` · ${occurrence.payment_notes}` : ""}
          </Text>
        )}
      </View>
      {occurrence.paid_amount != null ? (
        <Text
          className="text-label text-neutral-700 dark:text-neutral-300 font-medium"
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

  const { data: bill, isLoading, isError, error, refetch } = useBill(id);
  const { data: occurrences = [] } = useBillOccurrences(id);
  const { data: reminderRules = [] } = useReminderRules(id);
  const { mutateAsync: deleteBill, isPending: isDeleting } = useDeleteBill();

  // Current (most actionable) occurrence
  const currentOccurrence = occurrences.find((o) =>
    ["due_today", "overdue", "expected_payment", "generated", "upcoming"].includes(o.state)
  ) ?? occurrences[0];

  const handleDelete = () => {
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
              Alert.alert("Error", e?.message ?? "Failed to delete bill.");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
        <Header title="Bill details" showBack />
        <LoadingSkeleton variant="detail" />
      </SafeAreaView>
    );
  }

  if (isError || !bill) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
        <Header title="Bill details" showBack />
        <ErrorView
          message={error instanceof Error ? error.message : "Failed to load bill."}
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
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
      <Header
        title={bill.title}
        showBack
        rightAction={
          <View className="flex-row gap-1">
            <IconButton
              icon={<Ionicons name="create-outline" size={20} color={Colors.neutral[600]} />}
              onPress={() => {}} // TODO: edit screen
              accessibilityLabel="Edit bill"
              variant="ghost"
            />
            <IconButton
              icon={<Ionicons name="trash-outline" size={20} color={Colors.red[600]} />}
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
                <Text className="text-label text-neutral-500 dark:text-neutral-400 mb-0.5">
                  {cat.name}
                  {bill.provider_name ? ` · ${bill.provider_name}` : ""}
                </Text>
                <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold text-center">
                  {bill.title}
                </Text>
              </View>

              {displayAmount != null ? (
                <Text
                  className="text-amount-lg text-neutral-900 dark:text-neutral-50 font-bold"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatCurrency(displayAmount, bill.currency)}
                </Text>
              ) : (
                <Text className="text-amount-lg text-neutral-400">Variable</Text>
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
                    <Text className="text-caption text-neutral-400">
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
              className="bg-emerald-500 rounded-input flex-row items-center justify-center gap-2 py-4"
              style={({ pressed }) => ({
                opacity:   pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Mark bill as paid"
            >
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text className="text-label text-white font-semibold">
                Mark as paid
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Bill details ────────────────────────────────────────────── */}
        <View className="px-4 mb-4">
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
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
                    <Text className="text-body text-neutral-500 dark:text-neutral-400">
                      {row!.label}
                    </Text>
                    <Text className="text-body text-neutral-900 dark:text-neutral-100 font-medium">
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
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
            Reminders
          </Text>
          {reminderRules.length === 0 ? (
            <Surface level="resting" bordered rounded="card" className="py-6 items-center">
              <Text className="text-body text-neutral-400">No reminders set</Text>
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
        {occurrences.length > 0 && (
          <View className="px-4">
            <Text className="text-caption text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
              History
            </Text>
            <Surface level="resting" bordered rounded="card">
              {occurrences.slice(0, 12).map((o, idx) => (
                <View key={o.id}>
                  <OccurrenceRow occurrence={o} />
                  {idx < Math.min(occurrences.length, 12) - 1 && <Divider inset={16} />}
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
    </SafeAreaView>
  );
}
