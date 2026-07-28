import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { useBills }       from "../../../hooks/useBills";
import { useDashboard, useMarkPaid } from "../../../hooks/useOccurrences";
import { BillCard }       from "../../../components/bills/BillCard";
import { SearchField }    from "../../../components/ui/SearchField";
import { Chip }           from "../../../components/ui/Chip";
import { LoadingSkeleton }from "../../../components/ui/LoadingSkeleton";
import { ErrorView }      from "../../../components/ui/ErrorView";
import { EmptyState }     from "../../../components/ui/EmptyState";
import { FAB }            from "../../../components/ui/FAB";
import { Colors }         from "../../../lib/theme";
import type { Bill, DashboardOccurrence } from "../../../lib/supabase/types";

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterKey = "all" | "overdue" | "due_today" | "upcoming" | "paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All"       },
  { key: "overdue",  label: "Overdue"   },
  { key: "due_today",label: "Due today" },
  { key: "upcoming", label: "Upcoming"  },
  { key: "paid",     label: "Recently paid" },
];

export default function BillsScreen() {
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<FilterKey>("all");

  const {
    data:        bills = [],
    isLoading:   billsLoading,
    isError:     billsError,
    error:       billsErrorObj,
    refetch,
    isRefetching,
  } = useBills();

  const { data: dashboard } = useDashboard();
  const { mutate: markPaid } = useMarkPaid();

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
        if (filter === "paid")      return o?.state === "paid";
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
  }, [bills, filter, search, occurrenceByBillId]);

  const handleMarkPaid = useCallback((billId: string) => {
    const o = occurrenceByBillId.get(billId);
    if (!o) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markPaid({
      occurrence_id: o.id,
      paid_amount:   o.amount ?? o.bills.amount_expected ?? 0,
      paid_at:       new Date().toISOString(),
    });
  }, [occurrenceByBillId, markPaid]);

  const isLoading = billsLoading;
  const isError   = billsError;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
      {/* ── Sticky header with search ──────────────────────────────── */}
      <View className="px-4 pt-4 pb-2 gap-3 bg-neutral-50 dark:bg-neutral-950">
        <Text className="text-display text-neutral-900 dark:text-neutral-50">Bills</Text>

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
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading && <LoadingSkeleton variant="list" count={5} />}

      {isError && (
        <ErrorView
          message={billsErrorObj instanceof Error ? billsErrorObj.message : "Failed to load bills."}
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
          ListEmptyComponent={
            <EmptyState
              variant={search ? "search" : "bills"}
              ctaLabel={search ? undefined : "Add your first bill"}
              onCta={search ? undefined : () => router.push("/add-bill")}
            />
          }
          renderItem={({ item: bill }) => {
            const occurrence = occurrenceByBillId.get(bill.id);
            return (
              <BillCard
                bill={bill as any}
                occurrence={occurrence}
                onPress={() => router.push(`/bill/${bill.id}`)}
                onMarkPaid={() => handleMarkPaid(bill.id)}
              />
            );
          }}
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────────── */}
      <View className="absolute bottom-6 right-4" pointerEvents="box-none">
        <FAB onPress={() => router.push("/add-bill")} label="Add bill" />
      </View>
    </SafeAreaView>
  );
}
