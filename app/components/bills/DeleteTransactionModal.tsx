import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { AlertBadge } from "../ui/AlertBadge";
import { DateAnchorPicker } from "../ui/DateAnchorPicker";
import { useDeleteTransaction } from "../../hooks/useOccurrences";
import type { BillOccurrence, Bill } from "../../lib/supabase/types";

export interface DeleteTransactionTarget {
  occurrence: BillOccurrence;
  bill: Bill;
  isOldest: boolean;
  hasOlder: boolean;
  previousCycleStart?: string | null;
}

interface DeleteTransactionModalProps {
  target: DeleteTransactionTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DeleteTransactionModal({ target, onClose, onSuccess }: DeleteTransactionModalProps) {
  const [error, setError] = useState<string | null>(null);

  const isPrepaidOrWallet = target
    ? target.bill.behavior_type === "prepaid_validity" || target.bill.behavior_type === "wallet_balance"
    : false;

  const [anchorAction, setAnchorAction] = useState<"keep" | "revert" | "custom">("keep");

  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1);
  const [customDay, setCustomDay] = useState(new Date().getDate());
  const [customYear, setCustomYear] = useState(new Date().getFullYear());

  const { mutateAsync, isPending } = useDeleteTransaction();

  const currentAnchorDate = useMemo(() => {
    if (!target) return null;
    return target.bill.anchor_date || target.occurrence.cycle_start;
  }, [target?.bill.anchor_date, target?.occurrence.cycle_start]);

  useEffect(() => {
    if (target) {
      setError(null);
      setAnchorAction("keep");
      const now = new Date();
      setCustomMonth(now.getMonth() + 1);
      setCustomDay(now.getDate());
      setCustomYear(now.getFullYear());
    }
  }, [target?.occurrence.id]);

  const handleConfirm = async () => {
    if (!target) return;

    if (isPrepaidOrWallet && anchorAction === "custom") {
      if (!customMonth || !customDay || !customYear) {
        setError("Please select a valid date.");
        return;
      }
      const customDate = new Date(customYear, customMonth - 1, customDay);
      const billCreated = new Date(target.bill.created_at);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (customDate < billCreated) {
        setError("Date cannot be before the bill was created.");
        return;
      }
      if (customDate > today) {
        setError("Date cannot be in the future.");
        return;
      }
    }

    setError(null);
    try {
      const customAnchor = isPrepaidOrWallet && anchorAction === "custom"
        ? `${customYear}-${String(customMonth).padStart(2, "0")}-${String(customDay).padStart(2, "0")}`
        : null;

      await mutateAsync({
        occurrence_id: target.occurrence.id,
        anchor_action: isPrepaidOrWallet ? anchorAction : "keep",
        custom_anchor: customAnchor,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal visible={target !== null} onClose={handleClose} variant="bottom">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="gap-0.5">
          <Text className="text-title text-primary font-semibold">
            Delete payment?
          </Text>
          {target && (
            <Text className="text-caption text-secondary" numberOfLines={1}>
              {target.bill.title} · {formatDate(target.occurrence.cycle_start)}
            </Text>
          )}
        </View>

        {/* Warning */}
        <AlertBadge
          message="This payment record will be removed from your history."
          variant="warning"
        />

        {/* Inline error */}
        {!!error && <AlertBadge message={error} variant="error" />}

        {/* Anchor options — only for prepaid/wallet bills */}
        {isPrepaidOrWallet && (
          <View className="gap-3">
            <Text className="text-body text-primary font-medium">
              How should the billing cycle be adjusted?
            </Text>
            <View className="bg-surface-elevated rounded-xl overflow-hidden">
              {/* Keep current anchor */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setAnchorAction("keep");
                }}
                className="p-4 flex-row items-center border-b border-surface-divider"
              >
                <View className="flex-1">
                  <Text className="text-body text-primary font-medium">Keep current schedule</Text>
                  <Text className="text-caption text-secondary mt-0.5">
                    {currentAnchorDate ? `Stay on ${formatDate(currentAnchorDate)}` : "Keep the existing billing cycle"}
                  </Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${anchorAction === "keep" ? "border-accent" : "border-surface-divider"}`}>
                  {anchorAction === "keep" && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </View>
              </TouchableOpacity>

              {/* Revert to previous payment */}
              {target?.hasOlder && target?.previousCycleStart && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAnchorAction("revert");
                  }}
                  className="p-4 flex-row items-center border-b border-surface-divider"
                >
                  <View className="flex-1">
                    <Text className="text-body text-primary font-medium">Revert to previous date</Text>
                    <Text className="text-caption text-secondary mt-0.5">
                      Reset to {formatDate(target.previousCycleStart)}
                    </Text>
                  </View>
                  <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${anchorAction === "revert" ? "border-accent" : "border-surface-divider"}`}>
                    {anchorAction === "revert" && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </View>
                </TouchableOpacity>
              )}

              {/* Custom date */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setAnchorAction("custom");
                }}
                className="p-4 flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="text-body text-primary font-medium">Choose a different date</Text>
                  <Text className="text-caption text-secondary mt-0.5">Manually pick a start date</Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${anchorAction === "custom" ? "border-accent" : "border-surface-divider"}`}>
                  {anchorAction === "custom" && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Custom date picker */}
            {anchorAction === "custom" && (
              <View className="mt-1">
                <DateAnchorPicker
                  showMonth
                  showDay
                  showYear
                  month={customMonth}
                  day={customDay}
                  year={customYear}
                  onMonthChange={setCustomMonth}
                  onDayChange={setCustomDay}
                  onYearChange={setCustomYear}
                  dateLabel="New start date"
                />
              </View>
            )}
          </View>
        )}

        {/* Fixed due date — explain no schedule change */}
        {!isPrepaidOrWallet && (
          <Text className="text-caption text-secondary">
            This is a fixed-date bill. Only this payment record will be removed; the billing schedule stays the same.
          </Text>
        )}

        {/* Actions */}
        <View className="flex-row gap-3 mt-2">
          <View className="flex-1">
            <Button title="Cancel" variant="secondary" onPress={handleClose} fullWidth />
          </View>
          <View className="flex-1">
            <Button
              title="Delete"
              variant="destructive"
              onPress={handleConfirm}
              loading={isPending}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
