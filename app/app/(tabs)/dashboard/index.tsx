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
      className={`flex-1 rounded-card p-3 ${bg}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      accessibilityRole={onPress ? "button" : "none"}
      accessibilityLabel={`${count} ${label}`}
    >
      <View className="flex-row items-center gap-1.5 mb-2">
        <Ionicons name={icon} size={14} className={iconColor} />
        <Text className={`text-[11px] font-semibold tracking-wide ${iconColor}`}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text
        className={`text-[28px] font-bold tracking-tight leading-8 font-mono tabular-nums ${iconColor}`}
      >
        {count}
      </Text>
    </Pressable>
  );
}

// ── Total banner ──────────────────────────────────────────────────────────────

function TotalBanner({ amount }: { amount: number }) {
  return (
    <View className="bg-primary rounded-card p-5 flex-row items-center justify-between shadow-resting">
      <View>
        <Text className="text-caption text-canvas mb-1 font-medium opacity-80">
          Total owed now
        </Text>
        <Text
          className="text-[28px] leading-[34px] font-bold tracking-tight text-canvas font-mono tabular-nums"
        >
          {formatCurrency(amount)}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/bills")}
        className="bg-canvas rounded-input px-4 py-2.5 border border-border"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="View all bills"
      >
        <Text className="text-label text-primary font-semibold">
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
        <View className="bg-surface border border-border rounded-card py-5 items-center mx-0.5">
          <Text className="text-caption text-secondary">
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
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#A3A3A3"
          />
        }
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="px-5 pt-6 pb-6">
          <Text className="text-caption text-secondary mb-1">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text className="text-[32px] leading-[40px] font-bold tracking-tight text-primary">
            Your bills
          </Text>
        </View>

        {isLoading && <LoadingSkeleton variant="dashboard" />}

        {isError && (
          <ErrorView
            message="Failed to load dashboard."
            onRetry={refetch}
          />
        )}

        {data && (
          <View className="px-4 gap-6">
            {/* ── Summary pills ──────────────────────────────────────── */}
            <View className="flex-row gap-3 mb-4">
              <SummaryPill
                label="Overdue"
                count={data.overdue.length}
                icon="warning-outline"
                iconColor="text-error"
                bg="bg-error/10 border border-error/20"
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryPill
                label="Today"
                count={data.today.length}
                icon="today-outline"
                iconColor="text-accent"
                bg="bg-accent/10 border border-accent/20"
                onPress={() => router.push("/(tabs)/bills")}
              />
              <SummaryPill
                label="Upcoming"
                count={data.upcoming.length}
                icon="time-outline"
                iconColor="text-success"
                bg="bg-success/10 border border-success/20"
              />
            </View>

            {/* ── Total owed banner ──────────────────────────────────── */}
            {totalDueNow != null && <TotalBanner amount={totalDueNow} />}

            {/* ── Action Required (overdue + due today) ─────────────────── */}
            {(() => {
              const actionRequired = [...data.overdue, ...data.today];
              return (
                <OccurrenceSection
                  title={`Action Required · ${actionRequired.length}`}
                  items={actionRequired}
                  emptyLabel="All clear! No bills need attention."
                  onViewBill={(id) => router.push(`/bill/${id}`)}
                  onMarkPaid={handleMarkPaid}
                />
              );
            })()}

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

      {/* ── FAB ──────────────────────────────────────────────────────── */}
      {!isEmpty && (
        <View className="absolute bottom-6 right-4" pointerEvents="box-none">
          <FAB onPress={() => router.push("/add-bill")} label="Add bill" />
        </View>
      )}

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
