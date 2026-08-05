import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, Clock, List, ChevronRight } from "lucide-react";
import { useDashboard } from "../../hooks/useOccurrences";
import { useProfile } from "../../hooks/useProfile";
import BillCard from "../../components/bills/BillCard";
import MarkPaidModal, { type MarkPaidTarget } from "../../components/bills/MarkPaidModal";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorView from "../../components/ui/ErrorView";
import EmptyState from "../../components/ui/EmptyState";
import SectionHeader from "../../components/ui/SectionHeader";
import FAB from "../../components/ui/FAB";
import { useToast } from "../../components/ui/Toast";
import { formatCurrency, getGreeting } from "../../lib/utils";
import type { DashboardOccurrence } from "../../lib/types";

function SummaryPill({
  label, count, Icon, iconClass, bg, onClick,
}: {
  label: string;
  count: number;
  Icon: typeof AlertTriangle;
  iconClass: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-card p-3 text-left transition-all duration-150 active:scale-[0.98] ${bg} ${onClick ? "cursor-pointer" : "cursor-default"}`}
      aria-label={`${count} ${label}`}
    >
      <div className={`flex items-center gap-1.5 mb-2 ${iconClass}`}>
        <Icon size={14} />
        <span className="text-[11px] font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <span className={`text-[28px] font-bold tracking-tight leading-8 font-mono tabular-nums ${iconClass}`}>
        {count}
      </span>
    </button>
  );
}

function TotalBanner({ amount }: { amount: number }) {
  const navigate = useNavigate();
  return (
    <div className="bg-primary rounded-card p-5 flex items-center justify-between shadow-resting">
      <div>
        <p className="text-[11px] font-medium text-canvas mb-1 opacity-80">Total owed now</p>
        <p className="text-[28px] leading-[34px] font-bold tracking-tight text-canvas font-mono tabular-nums">
          {formatCurrency(amount)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/app/bills")}
        className="bg-canvas rounded-input px-4 py-2.5 border border-border text-[13px] font-semibold text-primary hover:bg-input transition-colors"
      >
        View all
      </button>
    </div>
  );
}

function ViewAllButton({ total, onPress }: { total: number; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full rounded-card border border-border flex items-center justify-center gap-2 py-3 bg-white/[0.06] hover:bg-input/60 transition-colors"
    >
      <List size={15} className="text-secondary" />
      <span className="text-xs font-semibold text-secondary">View all {total}</span>
      <ChevronRight size={13} className="text-secondary" />
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();
  const { data: profile } = useProfile();
  const { showToast } = useToast();
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);

  const openMarkPaid = (o: DashboardOccurrence) => {
    setMarkPaidTarget({
      occurrence:     o,
      billTitle:      o.bills.title,
      amountExpected: o.amount ?? o.bills.amount_expected ?? null,
      behaviorType:   o.bills.behavior_type,
    });
  };

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  const totalDueNow = useMemo(() => {
    if (!data) return null;
    const sum = [...data.today, ...data.overdue].reduce(
      (acc, o) => acc + (o.amount ?? o.bills.amount_expected ?? 0),
      0
    );
    return sum > 0 ? sum : null;
  }, [data]);

  const isEmpty = data && data.today.length === 0 && data.overdue.length === 0 && data.upcoming.length === 0;

  const actionRequired = useMemo(
    () => (data ? [...data.overdue, ...data.today] : []),
    [data]
  );

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-secondary mb-1">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="text-[32px] leading-[40px] font-bold tracking-tight text-primary">Your bills</h1>
        </div>
        {isRefetching && (
          <span className="text-xs text-secondary animate-pulse">Refreshing…</span>
        )}
      </div>

      {isLoading && <LoadingSkeleton variant="dashboard" />}

      {isError && (
        <ErrorView message="Failed to load dashboard." onRetry={refetch} />
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryPill
              label="Overdue"
              count={data.overdue.length}
              Icon={AlertTriangle}
              iconClass="text-error"
              bg="bg-error/10 border border-error/20"
              onClick={() => navigate("/app/bills")}
            />
            <SummaryPill
              label="Today"
              count={data.today.length}
              Icon={CalendarClock}
              iconClass="text-accent"
              bg="bg-accent/10 border border-accent/20"
              onClick={() => navigate("/app/bills")}
            />
            <SummaryPill
              label="Upcoming"
              count={data.upcoming.length}
              Icon={Clock}
              iconClass="text-success"
              bg="bg-success/10 border border-success/20"
            />
          </div>

          {totalDueNow != null && <TotalBanner amount={totalDueNow} />}

          {/* Action required — all items */}
          <section>
            <SectionHeader title={`Action Required · ${actionRequired.length}`} />
            {actionRequired.length === 0 ? (
              <div className="bg-surface border border-border rounded-card py-5 text-center">
                <p className="text-xs text-secondary">All clear! No bills need attention.</p>
              </div>
            ) : (
              actionRequired.map((o) => (
                <BillCard
                  key={o.id}
                  bill={o.bills as any}
                  occurrence={o}
                  onPress={() => navigate(`/app/bill/${o.bills.id}`)}
                  onMarkPaid={() => openMarkPaid(o)}
                />
              ))
            )}
          </section>

          {/* Upcoming — capped at 5 */}
          <section>
            <SectionHeader title="Upcoming" />
            {data.upcoming.length === 0 ? (
              <div className="bg-surface border border-border rounded-card py-5 text-center">
                <p className="text-xs text-secondary">No upcoming bills</p>
              </div>
            ) : (
              <>
                {data.upcoming.slice(0, 5).map((o) => (
                  <BillCard
                    key={o.id}
                    bill={o.bills as any}
                    occurrence={o}
                    onPress={() => navigate(`/app/bill/${o.bills.id}`)}
                    onMarkPaid={() => openMarkPaid(o)}
                  />
                ))}
                {data.upcoming.length > 5 && (
                  <ViewAllButton total={data.upcoming.length} onPress={() => navigate("/app/bills")} />
                )}
              </>
            )}
          </section>

          {/* Recently paid — capped at 3 */}
          {data.recentlyPaid.length > 0 && (
            <section>
              <SectionHeader title="Recently paid" />
              {data.recentlyPaid.slice(0, 3).map((o) => (
                <BillCard
                  key={o.id}
                  bill={o.bills as any}
                  occurrence={o}
                  onPress={() => navigate(`/app/bill/${o.bills.id}`)}
                  onMarkPaid={null}
                />
              ))}
              {data.recentlyPaid.length > 3 && (
                <ViewAllButton total={data.recentlyPaid.length} onPress={() => navigate("/app/bills")} />
              )}
            </section>
          )}

          {isEmpty && (
            <EmptyState
              variant="bills"
              ctaLabel="Add your first bill"
              onCta={() => navigate("/app/add-bill")}
            />
          )}
        </div>
      )}

      {!isEmpty && <FAB />}

      <MarkPaidModal
        target={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() =>
          showToast(`${markPaidTarget?.billTitle ?? "Bill"} marked as paid`, "success")
        }
      />
    </div>
  );
}