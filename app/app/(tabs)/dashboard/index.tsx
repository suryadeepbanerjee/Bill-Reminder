import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useDashboard }       from "../../../hooks/useOccurrences";
import { useMarkPaid }        from "../../../hooks/useOccurrences";
import { useProfile }         from "../../../hooks/useProfile";
import { useToast }           from "../../../hooks/useToast";
import { BillCard }           from "../../../components/bills/BillCard";
import { LoadingSkeleton }    from "../../../components/ui/LoadingSkeleton";
import { ErrorView }          from "../../../components/ui/ErrorView";
import { EmptyState }         from "../../../components/ui/EmptyState";
import { SectionHeader }      from "../../../components/ui/SectionHeader";
import { FAB }                from "../../../components/ui/FAB";
import { Divider }            from "../../../components/ui/Divider";
import { Toast }              from "../../../components/ui/Toast";
import { Colors }             from "../../../lib/theme";
import {
  formatCurrency,
  formatDate,
} from "../../../lib/utils";
import type { DashboardOccurrence } from "../../../lib/supabase/types";

// ── Greeting ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon:  keyof typeof Ionicons.glyphMap;
  color: string;
  bg:    string;
  onPress?: () => void;
}

function SummaryCard({ label, value, icon, color, bg, onPress }: SummaryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-card p-3 gap-2"
      style={[{ backgroundColor: bg }, ({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })]}
      accessibilityRole={onPress ? "button" : "none"}
      accessibilityLabel={`${value} ${label}`}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text className="text-amount font-semibold" style={{ color, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text className="text-caption font-medium" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Occurrence section ────────────────────────────────────────────────────────

function OccurrenceSection({
  title,
  items,
  emptyLabel,
  onViewBill,
  onMarkPaid,
  limit = 3,
}: {
  title:      string;
  items:      DashboardOccurrence[];
  emptyLabel: string;
  onViewBill: (billId: string) => void;
  onMarkPaid: (o: DashboardOccurrence) => void;
  limit?:     number;
}) {
  const shown    = items.slice(0, limit);
  const hasMore  = items.length > limit;

  return (
    <View>
      <SectionHeader
        title={title}
        action={hasMore ? { label: `+${items.length - limit} more`, onPress: () => router.push("/(tabs)/bills") } : undefined}
      />
      {shown.length === 0 ? (
        <View className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-card py-6 items-center">
          <Text className="text-body text-neutral-400">{emptyLabel}</Text>
        </View>
      ) : (
        shown.map((o) => (
          <BillCard
            key={o.id}
            bill={o.bills as any}
            occurrence={o}
            onPress={() => onViewBill(o.bills.id)}
            onMarkPaid={() => onMarkPaid(o)}
          />
        ))
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useDashboard();

  const { data: profile }   = useProfile();
  const { mutate: markPaid } = useMarkPaid();
  const { toast, showToast } = useToast();

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  const handleMarkPaid = (o: DashboardOccurrence) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markPaid(
      {
        occurrence_id: o.id,
        paid_amount:   o.amount ?? o.bills.amount_expected ?? 0,
        paid_at:       new Date().toISOString(),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(`${o.bills.title} marked as paid`, "success");
        },
        onError: () => {
          showToast("Could not mark as paid. Try again.", "error");
        },
      }
    );
  };

  // Total owed today
  const totalDueToday = useMemo(() => {
    if (!data) return null;
    const sum = [...data.today, ...data.overdue]
      .reduce((acc, o) => acc + (o.amount ?? o.bills.amount_expected ?? 0), 0);
    return sum > 0 ? sum : null;
  }, [data]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.neutral[400]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-5">
          <Text className="text-caption text-neutral-400 dark:text-neutral-500 mb-0.5">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text className="text-display text-neutral-900 dark:text-neutral-50">
            Your bills
          </Text>
        </View>

        {isLoading && (
          <LoadingSkeleton variant="dashboard" />
        )}

        {isError && (
          <ErrorView
            message={error instanceof Error ? error.message : "Failed to load dashboard."}
            onRetry={refetch}
          />
        )}

        {data && (
          <View className="px-4 gap-6">
            {/* ── Summary row ────────────────────────────────────────── */}
            <View className="flex-row gap-3">
              <SummaryCard
                label="Overdue"
                value={data.overdue.length}
                icon="warning-outline"
                color={Colors.amber[700]}
                bg={Colors.amber[50]}
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryCard
                label="Due today"
                value={data.today.length}
                icon="alert-outline"
                color={Colors.accent[500]}
                bg={Colors.accent[50]}
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryCard
                label="Upcoming"
                value={data.upcoming.length}
                icon="time-outline"
                color={Colors.neutral[600]}
                bg={Colors.neutral[100]}
              />
            </View>

            {/* Total amount banner — only show when there's something owed */}
            {totalDueToday != null && (
              <View className="bg-neutral-900 dark:bg-neutral-100 rounded-card p-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-caption text-neutral-400 dark:text-neutral-600 mb-0.5">
                    Total owed now
                  </Text>
                  <Text
                    className="text-amount-lg text-white dark:text-neutral-900 font-bold"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {formatCurrency(totalDueToday)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(tabs)/bills")}
                  className="bg-white dark:bg-neutral-800 rounded-input px-4 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold">
                    View all
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── Overdue ────────────────────────────────────────────── */}
            {data.overdue.length > 0 && (
              <OccurrenceSection
                title={`Overdue (${data.overdue.length})`}
                items={data.overdue}
                emptyLabel="No overdue bills"
                onViewBill={(id) => router.push(`/bill/${id}`)}
                onMarkPaid={handleMarkPaid}
                limit={3}
              />
            )}

            {/* ── Due today ──────────────────────────────────────────── */}
            <OccurrenceSection
              title="Due today"
              items={data.today}
              emptyLabel="Nothing due today"
              onViewBill={(id) => router.push(`/bill/${id}`)}
              onMarkPaid={handleMarkPaid}
            />

            {/* ── Upcoming ───────────────────────────────────────────── */}
            <OccurrenceSection
              title="Upcoming"
              items={data.upcoming}
              emptyLabel="No upcoming bills"
              onViewBill={(id) => router.push(`/bill/${id}`)}
              onMarkPaid={handleMarkPaid}
              limit={5}
            />

            {/* ── Recently paid ──────────────────────────────────────── */}
            {data.recentlyPaid.length > 0 && (
              <OccurrenceSection
                title="Recently paid"
                items={data.recentlyPaid}
                emptyLabel=""
                onViewBill={(id) => router.push(`/bill/${id}`)}
                onMarkPaid={() => {}}
                limit={3}
              />
            )}

            {/* ── Empty state for brand-new users ────────────────────── */}
            {data.today.length === 0 &&
              data.overdue.length === 0 &&
              data.upcoming.length === 0 && (
                <EmptyState
                  variant="bills"
                  ctaLabel="Add your first bill"
                  onCta={() => router.push("/add-bill")}
                />
              )}
          </View>
        )}
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────── */}
      <View
        className="absolute bottom-6 right-4"
        pointerEvents="box-none"
      >
        <FAB onPress={() => router.push("/add-bill")} label="Add bill" />
      </View>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={toast.onDismiss}
      />
    </SafeAreaView>
  );
}
