import { supabase } from "./client";
import type { BillOccurrence, DashboardOccurrence, MarkPaidInput } from "./types";

const OCCURRENCE_WITH_BILL = `
  *,
  bills!inner (
    id, title, provider_name, behavior_type, amount_expected, currency, household_id,
    categories ( id, name, icon, color )
  )
`;

// ── Dashboard data ────────────────────────────────────────────────────────────

export interface DashboardData {
  today:        DashboardOccurrence[];
  upcoming:     DashboardOccurrence[];
  overdue:      DashboardOccurrence[];
  recentlyPaid: DashboardOccurrence[];
}

function getOccurrenceCategory(o: DashboardOccurrence): "overdue" | "today" | "upcoming" {
  const dateStr = o.due_date ?? o.expected_payment_date;
  if (!dateStr) return "upcoming";

  const dueDay = new Date(dateStr + "T00:00:00");
  const nowDay = new Date();
  const due = new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate());
  const now = new Date(nowDay.getFullYear(), nowDay.getMonth(), nowDay.getDate());
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  return "upcoming";
}

export async function fetchDashboardData(householdId: string): Promise<DashboardData> {
  const { data, error } = await supabase
    .from("bill_occurrences")
    .select(OCCURRENCE_WITH_BILL)
    .in("state", ["due_today", "overdue", "upcoming", "generated", "expected_payment", "paid"])
    .eq("bills.household_id", householdId)
    .eq("bills.is_active", true)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const allOccurrences = (data ?? []) as DashboardOccurrence[];

  // Categorize by actual due_date, not by state (state is updated hourly by cron)
  const today: DashboardOccurrence[] = [];
  const upcoming: DashboardOccurrence[] = [];
  const overdue: DashboardOccurrence[] = [];

  for (const o of allOccurrences) {
    if (o.state === "paid") continue;
    const cat = getOccurrenceCategory(o);
    if (cat === "overdue") overdue.push(o);
    else if (cat === "today") today.push(o);
    else upcoming.push(o);
  }

  const recentlyPaid = allOccurrences
    .filter(o => o.state === "paid")
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
    .slice(0, 10);

  return { today, upcoming, overdue, recentlyPaid };
}

// ── Bill timeline ─────────────────────────────────────────────────────────────

export async function fetchBillOccurrences(billId: string): Promise<BillOccurrence[]> {
  const { data, error } = await supabase
    .from("bill_occurrences")
    .select("*")
    .eq("bill_id", billId)
    .order("cycle_start", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BillOccurrence[];
}

export async function fetchCurrentOccurrence(billId: string): Promise<BillOccurrence | null> {
  const { data } = await supabase
    .from("bill_occurrences")
    .select("*")
    .eq("bill_id", billId)
    .in("state", ["due_today", "overdue", "expected_payment", "generated", "upcoming"])
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as BillOccurrence | null;
}

// ── Mark paid (atomic: pay + cancel reminders) ────────────────────────────────

export async function markOccurrencePaid(input: MarkPaidInput): Promise<void> {
  // First: update the occurrence to paid state
  const { error: occError } = await supabase
    .from("bill_occurrences")
    .update({
      state:         "paid",
      paid_at:       input.paid_at,
      paid_amount:   input.paid_amount,
      payment_notes: input.payment_notes ?? null,
      receipt_path:  input.receipt_path  ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", input.occurrence_id)
    .in("state", ["due_today", "overdue", "expected_payment", "generated", "upcoming"]);

  if (occError) throw new Error(occError.message);

  // Second: cancel all pending scheduled reminders for this occurrence
  const { error: remError } = await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled" })
    .eq("occurrence_id", input.occurrence_id)
    .eq("status", "pending");

  if (remError) {
    // Non-fatal — log but don't block the payment success
    console.warn("Failed to cancel reminders:", remError.message);
  }

  // Next occurrence generation is handled server-side by:
  // 1. The occurrences_after_update_paid trigger (migration 018)
  // 2. The occurrence-generator edge function (daily cron)
}
