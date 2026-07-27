import { Pressable, View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Bill, BillOccurrence } from "../../lib/supabase/types";
import { CategoryIconBadge } from "./CategoryPill";
import { BillStateChip } from "./BillStateChip";
import {
  formatCurrency,
  formatRelativeDate,
  formatOverdueLabel,
} from "../../lib/utils";
import { Colors } from "../../lib/theme";

interface BillCardProps {
  bill:        Bill & { categories: { name: string; icon: string; color: string } };
  occurrence?: BillOccurrence;
  onPress?:    () => void;
  onMarkPaid?: () => void;
}

export function BillCard({ bill, occurrence, onPress, onMarkPaid }: BillCardProps) {
  const cat = bill.categories;

  // Resolve display amount
  const displayAmount = occurrence?.amount ?? bill.amount_expected;

  // Resolve due date label
  const dueDate = occurrence?.due_date ?? occurrence?.expected_payment_date;
  const dueDateLabel = occurrence?.state
    ? (["overdue", "due_today"].includes(occurrence.state)
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
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-card mb-2 overflow-hidden"
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
            className="text-label text-neutral-900 dark:text-neutral-50 font-semibold"
            numberOfLines={1}
          >
            {bill.title}
          </Text>
          {bill.provider_name ? (
            <Text
              className="text-caption text-neutral-500 dark:text-neutral-400 mt-0.5"
              numberOfLines={1}
            >
              {bill.provider_name}
            </Text>
          ) : null}
          {/* State chip */}
          {occurrence && (
            <View className="mt-1.5">
              <BillStateChip
                state={occurrence.state}
                label={["overdue","due_today"].includes(occurrence.state) ? dueDateLabel! : undefined}
              />
            </View>
          )}
        </View>

        {/* Amount + date + quick action */}
        <View className="items-end gap-1">
          {displayAmount != null ? (
            <Text
              className="text-label text-neutral-900 dark:text-neutral-50 font-semibold"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatCurrency(displayAmount, bill.currency)}
            </Text>
          ) : (
            <Text className="text-label text-neutral-400">—</Text>
          )}
          {dueDateLabel && !["overdue","due_today"].includes(occurrence?.state ?? "") ? (
            <Text className="text-caption text-neutral-400 dark:text-neutral-500">
              {dueDateLabel}
            </Text>
          ) : null}

          {/* Quick "Mark Paid" for actionable states */}
          {onMarkPaid && occurrence && ["due_today","overdue","expected_payment"].includes(occurrence.state) && (
            <Pressable
              onPress={handleMarkPaid}
              accessibilityRole="button"
              accessibilityLabel="Mark as paid"
              className="mt-1"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.emerald[600]} />
                <Text className="text-caption text-emerald-600 font-medium">Mark paid</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
