import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import type { ListRenderItem } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { useBills }                  from "../../../hooks/useBills";
import { useDashboard }              from "../../../hooks/useOccurrences";
import { BillCard }                  from "../../../components/bills/BillCard";
import { MarkPaidModal }             from "../../../components/bills/MarkPaidModal";
import type { MarkPaidTarget }       from "../../../components/bills/MarkPaidModal";
import { SearchField }               from "../../../components/ui/SearchField";
import { Chip }                      from "../../../components/ui/Chip";
import { LoadingSkeleton }           from "../../../components/ui/LoadingSkeleton";
import { ErrorView }                 from "../../../components/ui/ErrorView";
import { EmptyState }                from "../../../components/ui/EmptyState";
import { FAB }                       from "../../../components/ui/FAB";
import { Colors }                    from "../../../lib/theme";
import { useHouseholdStore }         from "../../../stores/household-store";
import { canEditBills }              from "@shared/utils/roles";
import type { Bill, DashboardOccurrence } from "@shared/types";

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterKey = "all" | "overdue" | "due_today" | "upcoming" | "paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All"       },
  { key: "overdue",  label: "Overdue"   },
  { key: "due_today",label: "Due today" },
  { key: "upcoming", label: "Upcoming"  },
  { key: "paid",     label: "Recently paid" },
];

function isFilterKey(v: string | string[] | undefined): v is FilterKey {
  return typeof v === "string" && (FILTERS.map((f) => f.key) as string[]).includes(v);
}

export default function BillsScreen() {
  const params  = useLocalSearchParams<{ filter?: string; t?: string }>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>(() =>
    isFilterKey(params.filter) ? params.filter : "all"
  );
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);

  // Apply the deep-linked filter whenever the dashboard re-points us here
  // (the tab stays mounted, so state must follow the URL param changes).
  // `t` is a nonce the dashboard stamps so re-tapping the same pill still
  // re-applies its filter even though the tab never unmounts.
  useEffect(() => {
    if (isFilterKey(params.filter)) setFilter(params.filter);
  }, [params.filter, params.t]);

  const activeHousehold = useHouseholdStore((s) => s.activeHousehold);
  const canEdit = canEditBills(activeHousehold?.member.role);

  const {
    data:        bills = [],
    isLoading:   billsLoading,
    isError:     billsError,
    error:       billsErrorObj,
    refetch,
    isRefetching,
  } = useBills();

  const { data: dashboard } = useDashboard();

  // Build a map of billId → latest occurrence so BillCard can show state
  const occurrenceByBillId = useMemo(() => {
    const map = new Map<string, DashboardOccurrence>();
    if (!dashboard) return map;
    const all = [
      ...dashboard.today,
      ...dashboard.overdue,
      ...dashboard.upcoming,
      ...dashboard.recentlyPaid,
    ];
    // Latest/most-important state wins
    for (const o of all) {
      const existing = map.get(o.bills.id);
      if (!existing) { map.set(o.bills.id, o); continue; }
      // Priority: overdue > due_today > expected_payment > upcoming > paid
      const priority = ["overdue","due_today","expected_payment","generated","upcoming","paid","archived"];
      if (priority.indexOf(o.state) < priority.indexOf(existing.state)) {
        map.set(o.bills.id, o);
      }
    }
    return map;
  }, [dashboard]);

  // Separate set of bill IDs that have at least one paid occurrence
  const paidBillIds = useMemo(() => {
    const set = new Set<string>();
    if (!dashboard) return set;
    for (const o of dashboard.recentlyPaid) {
      set.add(o.bills.id);
    }
    return set;
  }, [dashboard]);

  // Filter and search
  const filteredBills = useMemo(() => {
    let result = bills;

    // Apply state filter using occurrence map
    if (filter !== "all") {
      result = result.filter((b: Bill) => {
        const o = occurrenceByBillId.get(b.id);
        if (filter === "overdue")   return o?.state === "overdue";
        if (filter === "due_today") return o?.state === "due_today";
        if (filter === "upcoming")  return ["upcoming","generated","expected_payment"].includes(o?.state ?? "");
        if (filter === "paid")      return paidBillIds.has(b.id);
        return true;
      });
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b: Bill) =>
          b.title.toLowerCase().includes(q) ||
          (b.provider_name ?? "").toLowerCase().includes(q) ||
          ((b as any).categories?.name ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [bills, filter, search, occurrenceByBillId, paidBillIds]);

  const openMarkPaid = useCallback((billId: string) => {
    const o = occurrenceByBillId.get(billId);
    if (!o) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMarkPaidTarget({
      occurrence:     o,
      billTitle:      o.bills.title,
      amountExpected: o.amount ?? o.bills.amount_expected ?? null,
      behaviorType:   o.bills.behavior_type,
    });
  }, [occurrenceByBillId]);

  // Stable identity so BillCard's memo actually prevents row re-renders
  // when the parent updates (search keystrokes, refetch, etc.).
  const renderItem = useCallback<ListRenderItem<Bill>>(({ item }) => {
    const occurrence = occurrenceByBillId.get(item.id);
    return (
      <BillCard
        bill={item as any}
        occurrence={occurrence}
        onPress={() => router.push(`/bill/${item.id}`)}
        onMarkPaid={canEdit ? () => openMarkPaid(item.id) : undefined}
      />
    );
  }, [occurrenceByBillId, openMarkPaid, canEdit]);

  const isLoading = billsLoading;
  const isError   = billsError;

  return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* ── Sticky header with search ──────────────────────────────── */}
      <View className="px-4 pt-4 pb-2 gap-3 bg-canvas">
        <Text className="text-display text-primary">Bills</Text>

        <SearchField
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search bills…"
        />

        {/* Filter chips — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => {
                setFilter(f.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            />
          ))}
        </ScrollView>

        {(search.trim() || filter !== "all") && (
          <Text className="text-caption text-secondary">
            {filteredBills.length} {filteredBills.length === 1 ? "bill" : "bills"} found
          </Text>
        )}
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading && <LoadingSkeleton variant="list" count={5} />}

      {isError && (
        <ErrorView
          message="Failed to load bills."
          onRetry={refetch}
        />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filteredBills}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{
            padding:      16,
            paddingBottom: 120,
            flexGrow:     1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#A3A3A3"
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={6}
          ListEmptyComponent={
            <EmptyState
              variant={search ? "search" : "bills"}
            />
          }
          renderItem={renderItem}
        />
      )}

      {/* ── Mark paid modal ─────────────────────────────────────────── */}
      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
      />

      {/* ── FAB ──────────────────────────────────────────────────────── */}
      {canEdit && (
        <View className="absolute bottom-6 right-4" pointerEvents="box-none">
          <FAB onPress={() => router.push("/add-bill")} label="Add bill" />
        </View>
      )}
    </SafeAreaView>
  );
}
