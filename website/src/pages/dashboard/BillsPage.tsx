import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBills } from "../../hooks/useBills";
import { useDashboard } from "../../hooks/useOccurrences";
import BillCard from "../../components/bills/BillCard";
import MarkPaidModal, { type MarkPaidTarget } from "../../components/bills/MarkPaidModal";
import SearchField from "../../components/ui/SearchField";
import Chip from "../../components/ui/Chip";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorView from "../../components/ui/ErrorView";
import EmptyState from "../../components/ui/EmptyState";
import FAB from "../../components/ui/FAB";
import type { Bill, DashboardOccurrence } from "@shared/types";

type FilterKey = "all" | "overdue" | "due_today" | "upcoming" | "paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "overdue",   label: "Overdue" },
  { key: "due_today", label: "Due today" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "paid",      label: "Recently paid" },
];

const FILTER_KEYS: FilterKey[] = FILTERS.map((f) => f.key);

export default function BillsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>(() => {
    const p = searchParams.get("filter") as FilterKey | null;
    return p && FILTER_KEYS.includes(p) ? p : "all";
  });
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);

  const applyFilter = (key: FilterKey) => {
    setFilter(key);
    setSearchParams(key === "all" ? {} : { filter: key }, { replace: true });
  };

  const {
    data: bills = [],
    isLoading: billsLoading,
    isError: billsError,
    refetch,
    isRefetching,
  } = useBills();

  const { data: dashboard } = useDashboard();

  const occurrenceByBillId = useMemo(() => {
    const map = new Map<string, DashboardOccurrence>();
    if (!dashboard) return map;
    const all = [
      ...dashboard.today,
      ...dashboard.overdue,
      ...dashboard.upcoming,
      ...dashboard.recentlyPaid,
    ];
    for (const o of all) {
      const existing = map.get(o.bills.id);
      if (!existing) { map.set(o.bills.id, o); continue; }
      const priority = ["overdue", "due_today", "expected_payment", "generated", "upcoming", "paid", "archived"];
      if (priority.indexOf(o.state) < priority.indexOf(existing.state)) {
        map.set(o.bills.id, o);
      }
    }
    return map;
  }, [dashboard]);

  const paidBillIds = useMemo(() => {
    const set = new Set<string>();
    if (!dashboard) return set;
    for (const o of dashboard.recentlyPaid) set.add(o.bills.id);
    return set;
  }, [dashboard]);

  const filteredBills = useMemo(() => {
    let result = bills;

    if (filter !== "all") {
      result = result.filter((b: Bill) => {
        const o = occurrenceByBillId.get(b.id);
        if (filter === "overdue")   return o?.state === "overdue";
        if (filter === "due_today") return o?.state === "due_today";
        if (filter === "upcoming")  return ["upcoming", "generated", "expected_payment"].includes(o?.state ?? "");
        if (filter === "paid")      return paidBillIds.has(b.id);
        return true;
      });
    }

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

  const openMarkPaid = (billId: string) => {
    const o = occurrenceByBillId.get(billId);
    if (!o) return;
    setMarkPaidTarget({
      occurrence:     o,
      billTitle:      o.bills.title,
      amountExpected: o.amount ?? o.bills.amount_expected ?? null,
      behaviorType:   o.bills.behavior_type,
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header + search + filters */}
      <div className="mb-5 space-y-4">
        <h1 className="text-[32px] leading-[40px] font-bold tracking-tight text-primary">Bills</h1>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search bills…"
        />
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => applyFilter(f.key)}
            />
          ))}
        </div>
      </div>

      {billsLoading && <LoadingSkeleton variant="list" count={5} />}

      {billsError && (
        <ErrorView message="Failed to load bills." onRetry={refetch} />
      )}

      {!billsLoading && !billsError && (
        <>
          {filteredBills.length === 0 ? (
            <EmptyState
              variant={search || filter !== "all" ? "search" : "bills"}
            />
          ) : (
            <div>
              {isRefetching && <p className="text-xs text-secondary text-right mb-1 animate-pulse">Refreshing…</p>}
              {filteredBills.map((b) => {
                const occurrence = occurrenceByBillId.get(b.id);
                return (
                  <BillCard
                    key={b.id}
                    bill={b as any}
                    occurrence={occurrence}
                    onPress={() => navigate(`/app/bill/${b.id}`)}
                    onMarkPaid={() => openMarkPaid(b.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <FAB />

      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() => {}}
      />
    </div>
  );
}