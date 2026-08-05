import { useMemo, useCallback, useState, memo } from "react";
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

import { useDashboard }              from "../../../hooks/useOccurrences";
import { useProfile }                from "../../../hooks/useProfile";
import { useToast }                  from "../../../hooks/useToast";
import { BillCard }                  from "../../../components/bills/BillCard";
import { MarkPaidModal }             from "../../../components/bills/MarkPaidModal";
import type { MarkPaidTarget }       from "../../../components/bills/MarkPaidModal";
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

// ── Ghost "View all" card ─────────────────────────────────────────────────────
// Renders a half-visible, blurred teaser card with a glass-style "View all" CTA.

function ViewAllGhostCard({
  total,
  onPress,
}: {
  total: number;
  onPress: () => void;
}) {
  return (
    // Outer wrapper — clips the card so only the top half is visible
    <View style={{ height: 52, overflow: "hidden", marginBottom: 4 }}>
      {/* The ghost card itself (full height, clipped by parent) */}
      <View
        className="bg-surface border border-border rounded-card"
        style={{ opacity: 0.55 }}
      >
        <View className="flex-row items-center gap-3 p-4">
          {/* placeholder shimmer blocks */}
          <View className="w-10 h-10 rounded-full bg-border" />
          <View className="flex-1 gap-2">
            <View className="h-3 w-32 rounded-full bg-border" />
            <View className="h-2.5 w-20 rounded-full bg-border" />
          </View>
          <View className="h-3 w-12 rounded-full bg-border" />
        </View>
      </View>
    </View>
  );
}

// ── Glass "View all" button ───────────────────────────────────────────────────

function ViewAllButton({
  total,
  onPress,
}: {
  total: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View all ${total} items`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <View
        className="rounded-card border border-border flex-row items-center justify-center gap-2 py-3"
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Ionicons name="list-outline" size={15} color="#A3A3A3" />
        <Text className="text-caption text-secondary font-semibold">
          View all {total}
        </Text>
        <Ionicons name="chevron-forward" size={13} color="#A3A3A3" />
      </View>
    </Pressable>
  );
}

// ── Occurrence section (unlimited) ────────────────────────────────────────────
// Used for "Action Required" — shows every item, no pagination.

// Memoized so the rows only re-render when the occurrence data (or stable
// callbacks) change — not on toast/modal state churn in the parent screen.

function UnlimitedOccurrenceSection({
  title,
  items,
  emptyLabel,
  onViewBill,
  onMarkPaid,
}: {
  title:      string;
  items:      DashboardOccurrence[];
  emptyLabel: string;
  onViewBill: (billId: string) => void;
  onMarkPaid: (o: DashboardOccurrence) => void;
}) {
  return (
    <View>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <View className="bg-surface border border-border rounded-card py-5 items-center mx-0.5">
          <Text className="text-caption text-secondary">
            {emptyLabel}
          </Text>
        </View>
      ) : (
        items.map((o) => (
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

const MemoizedUnlimitedSection = memo(UnlimitedOccurrenceSection);

// ── Occurrence section (capped with ghost footer) ─────────────────────────────
// Used for "Upcoming" and "Recently Paid" — shows up to `limit` items, then
// renders a half-visible ghost card + glass "View all" button when there are more.

function CappedOccurrenceSection({
  title,
  items,
  emptyLabel,
  onViewBill,
  onMarkPaid,
  limit,
}: {
  title:      string;
  items:      DashboardOccurrence[];
  emptyLabel: string;
  onViewBill: (billId: string) => void;
  onMarkPaid: (o: DashboardOccurrence) => void;
  limit:      number;
}) {
  const shown   = items.slice(0, limit);
  const hasMore = items.length > limit;
  return (
    <View>
      <SectionHeader title={title} />
      {shown.length === 0 ? (
        <View className="bg-surface border border-border rounded-card py-5 items-center mx-0.5">
          <Text className="text-caption text-secondary">
            {emptyLabel}
          </Text>
        </View>
      ) : (
        <>
          {shown.map((o) => (
            <BillCard
              key={o.id}
              bill={o.bills as any}
              occurrence={o}
              onPress={() => onViewBill(o.bills.id)}
              onMarkPaid={() => onMarkPaid(o)}
            />
          ))}

          {/* Half-visible ghost + View all — only when list is truncated */}
          {hasMore && (
            <>
              <ViewAllGhostCard total={items.length} onPress={() => router.push("/(tabs)/bills")} />
              <ViewAllButton    total={items.length} onPress={() => router.push("/(tabs)/bills")} />
            </>
          )}
        </>
      )}
    </View>
  );
}

const MemoizedCappedSection = memo(CappedOccurrenceSection);

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
  const { toast, showToast } = useToast();

  // ── Mark paid modal state ────────────────────────────────────────────
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);

  const openMarkPaid = useCallback((o: DashboardOccurrence) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMarkPaidTarget({
      occurrence:     o,
      billTitle:      o.bills.title,
      amountExpected: o.amount ?? o.bills.amount_expected ?? null,
      behaviorType:   o.bills.behavior_type,
    });
  }, []);

  const greeting  = useMemo(() => getGreeting(), []);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  // Stable handlers — memoized sections compare props by reference.
  const openBill = useCallback((id: string) => {
    router.push(`/bill/${id}`);
  }, []);

  const goToBills = useCallback(() => {
    router.push("/(tabs)/bills");
  }, []);

  const noop = useCallback(() => {}, []);

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

  const actionRequired = useMemo(
    () => (data ? [...data.overdue, ...data.today] : []),
    [data]
  );

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

            {/* ── Action Required — shows ALL items, no cap ─────────── */}
            <MemoizedUnlimitedSection
              title={`Action Required · ${actionRequired.length}`}
              items={actionRequired}
              emptyLabel="All clear! No bills need attention."
              onViewBill={openBill}
              onMarkPaid={openMarkPaid}
            />

            {/* ── Upcoming — capped at 5, ghost footer if more ───────── */}
            <MemoizedCappedSection
              title="Upcoming"
              items={data.upcoming}
              emptyLabel="No upcoming bills"
              onViewBill={openBill}
              onMarkPaid={openMarkPaid}
              limit={5}
            />

            {/* ── Recently paid — capped at 3, ghost footer if more ──── */}
            {data.recentlyPaid.length > 0 && (
              <MemoizedCappedSection
                title="Recently paid"
                items={data.recentlyPaid}
                emptyLabel=""
                onViewBill={openBill}
                onMarkPaid={noop}
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

      {/* ── Mark paid modal ──────────────────────────────────────── */}
      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() =>
          showToast(
            `${markPaidTarget?.billTitle ?? "Bill"} marked as paid`,
            "success"
          )
        }
      />

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
