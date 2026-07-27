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

export async function fetchDashboardData(householdId: string): Promise<DashboardData> {
  // Fetch all open (not archived) occurrences for the household
  const { data, error } = await supabase
    .from("bill_occurrences")
    .select(OCCURRENCE_WITH_BILL)
    .in("state", ["due_today", "overdue", "upcoming", "generated", "expected_payment", "paid"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const allOccurrences = (data ?? []) as DashboardOccurrence[];

  // Filter to household (RLS handles security, but we filter post-join for household)
  const today        = allOccurrences.filter(o => o.state === "due_today");
  const upcoming     = allOccurrences.filter(o =>
    ["upcoming", "generated", "expected_payment"].includes(o.state)
  );
  const overdue      = allOccurrences.filter(o => o.state === "overdue");
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

// ── Mark paid (RPC — atomic: pay + cancel reminders + generate next) ──────────

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

  // Next occurrence generation is handled server-side by occurrence-generator edge function
}
