import { memo } from "react";
import { Pressable, View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Bill, BillOccurrence, OccurrenceState } from "../../lib/supabase/types";
import { CategoryIconBadge } from "./CategoryPill";
import { BillStateChip } from "./BillStateChip";
import {
  formatCurrency,
  formatRelativeDate,
  formatOverdueLabel,
} from "../../lib/utils";

function getDisplayState(occurrence: BillOccurrence): OccurrenceState {
  if (occurrence.state === "paid" || occurrence.state === "archived") return occurrence.state;
  const dateStr = occurrence.due_date ?? occurrence.expected_payment_date;
  if (!dateStr) return occurrence.state;
  const dueDay = new Date(dateStr + "T00:00:00");
  const nowDay = new Date();
  const due = new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate());
  const now = new Date(nowDay.getFullYear(), nowDay.getMonth(), nowDay.getDate());
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  return "upcoming";
}

interface BillCardProps {
  bill:        Bill & { categories: { name: string; icon: string; color: string } };
  occurrence?: BillOccurrence;
  onPress?:    () => void;
  onMarkPaid?: () => void;
}

export const BillCard = memo(function BillCard({ bill, occurrence, onPress, onMarkPaid }: BillCardProps) {
  const cat = bill.categories;
  if (!cat) return null;
  const displayAmount = occurrence?.amount ?? bill.amount_expected;
  const displayState = occurrence ? getDisplayState(occurrence) : undefined;

  const dueDate = occurrence?.due_date ?? occurrence?.expected_payment_date;
  const dueDateLabel = displayState
    ? (["overdue", "due_today"].includes(displayState)
        ? formatOverdueLabel(dueDate)
        : formatRelativeDate(dueDate))
    : null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleMarkPaid = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMarkPaid?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${bill.title}, ${displayAmount ? formatCurrency(displayAmount) : "no amount"}`}
      className="bg-surface border border-border rounded-card mb-3 overflow-hidden shadow-resting"
      style={({ pressed }) => ({
        opacity:   pressed ? 0.86 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View className="flex-row items-center gap-3 p-4">
        {/* Category icon */}
        <CategoryIconBadge icon={cat.icon} color={cat.color} size={40} />

        {/* Bill info */}
        <View className="flex-1 min-w-0">
          <Text
            className="text-label text-primary font-semibold"
            numberOfLines={1}
          >
            {bill.title}
          </Text>
          {bill.provider_name ? (
            <Text
              className="text-caption text-secondary mt-0.5"
              numberOfLines={1}
            >
              {bill.provider_name}
            </Text>
          ) : null}
          {/* State chip */}
          {occurrence && (
            <View className="mt-1.5">
              <BillStateChip
                state={displayState!}
                label={["overdue","due_today"].includes(displayState!) ? dueDateLabel! : undefined}
              />
            </View>
          )}
        </View>

        {/* Amount + date + quick action */}
        <View className="items-end gap-1">
          {displayAmount != null ? (
            <Text
              className="text-label text-primary font-semibold font-mono tabular-nums"
            >
              {formatCurrency(displayAmount, bill.currency)}
            </Text>
          ) : (
            <Text className="text-label text-secondary font-mono">—</Text>
          )}
          {dueDateLabel && !["overdue","due_today"].includes(displayState ?? "") ? (
            <Text className="text-caption text-secondary font-mono">
              {dueDateLabel}
            </Text>
          ) : null}

          {/* Quick "Mark Paid" for actionable states */}
          {onMarkPaid && occurrence && ["due_today","overdue","expected_payment"].includes(displayState!) && (
            <Pressable
              onPress={handleMarkPaid}
              accessibilityRole="button"
              accessibilityLabel="Mark as paid"
              className="mt-1"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View className="flex-row items-center gap-1 mt-0.5">
                <Ionicons name="checkmark-circle-outline" size={14} className="text-success" />
                <Text className="text-caption text-success font-medium">Mark paid</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
});
