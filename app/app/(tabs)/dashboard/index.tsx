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

import { useDashboard, useMarkPaid } from "../../../hooks/useOccurrences";
import { useProfile }                from "../../../hooks/useProfile";
import { useToast }                  from "../../../hooks/useToast";
import { BillCard }                  from "../../../components/bills/BillCard";
import { LoadingSkeleton }           from "../../../components/ui/LoadingSkeleton";
import { ErrorView }                 from "../../../components/ui/ErrorView";
import { EmptyState }                from "../../../components/ui/EmptyState";
import { SectionHeader }             from "../../../components/ui/SectionHeader";
import { FAB }                       from "../../../components/ui/FAB";
import { Toast }                     from "../../../components/ui/Toast";
import { Colors }                    from "../../../lib/theme";
import { formatCurrency }            from "../../../lib/utils";
import type { DashboardOccurrence }  from "../../../lib/supabase/types";

// ── Greeting ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Summary pill ──────────────────────────────────────────────────────────────

interface SummaryPillProps {
  label:    string;
  count:    number;
  icon:     keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg:       string;
  onPress?: () => void;
}

function SummaryPill({ label, count, icon, iconColor, bg, onPress }: SummaryPillProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-card p-3"
      style={({ pressed }) => ({ backgroundColor: bg, opacity: pressed ? 0.82 : 1 })}
      accessibilityRole={onPress ? "button" : "none"}
      accessibilityLabel={`${count} ${label}`}
    >
      <View className="flex-row items-center gap-1.5 mb-2">
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={{ color: iconColor, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text
        style={{
          color:       iconColor,
          fontSize:    28,
          fontWeight:  "700",
          letterSpacing: -0.5,
          lineHeight:  32,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

// ── Total banner ──────────────────────────────────────────────────────────────

function TotalBanner({ amount }: { amount: number }) {
  return (
    <View className="bg-neutral-900 dark:bg-neutral-100 rounded-card p-4 flex-row items-center justify-between">
      <View>
        <Text className="text-caption text-neutral-400 dark:text-neutral-600 mb-0.5">
          Total owed now
        </Text>
        <Text
          className="text-amount-lg text-white dark:text-neutral-900 font-bold"
          style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}
        >
          {formatCurrency(amount)}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/bills")}
        className="bg-white dark:bg-neutral-800 rounded-input px-4 py-2.5"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="View all bills"
      >
        <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold">
          View all
        </Text>
      </Pressable>
    </View>
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
  const shown   = items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <View>
      <SectionHeader
        title={title}
        action={
          hasMore
            ? {
                label:   `See all ${items.length}`,
                onPress: () => router.push("/(tabs)/bills"),
              }
            : undefined
        }
      />
      {shown.length === 0 ? (
        <View className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-card py-5 items-center mx-0.5">
          <Text className="text-caption text-neutral-400 dark:text-neutral-500">
            {emptyLabel}
          </Text>
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

  const { data: profile }    = useProfile();
  const { mutate: markPaid } = useMarkPaid();
  const { toast, showToast } = useToast();

  const greeting  = useMemo(() => getGreeting(), []);
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

  const totalDueNow = useMemo(() => {
    if (!data) return null;
    const sum = [...data.today, ...data.overdue].reduce(
      (acc, o) => acc + (o.amount ?? o.bills.amount_expected ?? 0),
      0
    );
    return sum > 0 ? sum : null;
  }, [data]);

  const isEmpty =
    data &&
    data.today.length === 0 &&
    data.overdue.length === 0 &&
    data.upcoming.length === 0;

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
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="px-4 pt-6 pb-5">
          <Text className="text-caption text-neutral-400 dark:text-neutral-500 mb-1">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text className="text-display text-neutral-900 dark:text-neutral-50">
            Your bills
          </Text>
        </View>

        {isLoading && <LoadingSkeleton variant="dashboard" />}

        {isError && (
          <ErrorView
            message={error instanceof Error ? error.message : "Failed to load dashboard."}
            onRetry={refetch}
          />
        )}

        {data && (
          <View className="px-4 gap-5">
            {/* ── Summary pills ──────────────────────────────────────── */}
            <View className="flex-row gap-2.5">
              <SummaryPill
                label="Overdue"
                count={data.overdue.length}
                icon="warning-outline"
                iconColor={Colors.amber[600]}
                bg={Colors.amber[50]}
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryPill
                label="Today"
                count={data.today.length}
                icon="today-outline"
                iconColor={Colors.accent[500]}
                bg={Colors.accent[50]}
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryPill
                label="Upcoming"
                count={data.upcoming.length}
                icon="time-outline"
                iconColor={Colors.neutral[600]}
                bg={Colors.neutral[100]}
              />
            </View>

            {/* ── Total owed banner ──────────────────────────────────── */}
            {totalDueNow != null && <TotalBanner amount={totalDueNow} />}

            {/* ── Overdue ────────────────────────────────────────────── */}
            {data.overdue.length > 0 && (
              <OccurrenceSection
                title={`Overdue · ${data.overdue.length}`}
                items={data.overdue}
                emptyLabel=""
                onViewBill={(id) => router.push(`/bill/${id}`)}
                onMarkPaid={handleMarkPaid}
                limit={3}
              />
            )}

            {/* ── Due today ──────────────────────────────────────────── */}
            <OccurrenceSection
              title="Due today"
              items={data.today}
              emptyLabel="Nothing due today ✓"
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
            {isEmpty && (
              <EmptyState
                variant="bills"
                ctaLabel="Add your first bill"
                onCta={() => router.push("/add-bill")}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────── */}
      <View className="absolute bottom-6 right-4" pointerEvents="box-none">
        <FAB onPress={() => router.push("/add-bill")} label="Add bill" />
      </View>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={toast.onDismiss}
      />
    </SafeAreaView>
  );
}
