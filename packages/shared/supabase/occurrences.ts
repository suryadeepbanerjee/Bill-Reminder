import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillOccurrence,
  DashboardOccurrence,
  MarkPaidInput,
  DeleteTransactionInput,
} from "../types";

const OCCURRENCE_WITH_BILL = `
  *,
  bills!inner (
    id, title, provider_name, behavior_type, amount_expected, currency, household_id,
    categories ( id, name, icon, color )
  )
`;

// ── Dashboard data ─────────────────────────────────────────────────────────────

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

export interface OccurrencesApi {
  fetchDashboardData(householdId: string): Promise<DashboardData>;
  fetchBillOccurrences(billId: string): Promise<BillOccurrence[]>;
  fetchCurrentOccurrence(billId: string): Promise<BillOccurrence | null>;
  markOccurrencePaid(input: MarkPaidInput): Promise<void>;
  deleteOccurrenceTransaction(input: DeleteTransactionInput): Promise<void>;
}

/** Client-bound occurrences data layer. Each platform binds its own client. */
export function createOccurrencesApi(supabase: SupabaseClient): OccurrencesApi {
  return {
    async fetchDashboardData(householdId: string): Promise<DashboardData> {
      const { data, error } = await supabase
        .from("bill_occurrences")
        .select(OCCURRENCE_WITH_BILL)
        .in("state", ["due_today", "overdue", "upcoming", "generated", "expected_payment", "paid"])
        .is("deleted_at", null)
        .eq("bills.household_id", householdId)
        .eq("bills.is_active", true)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200);

      if (error) throw new Error(error.message);

      const allOccurrences = (data ?? []) as DashboardOccurrence[];

      // Dedup: keep only the highest-priority occurrence per bill
      // Priority: overdue > due_today > expected_payment > generated > upcoming > paid
      const statePriority: Record<string, number> = {
        overdue: 0, due_today: 1, expected_payment: 2, generated: 3, upcoming: 4, paid: 5, archived: 6,
      };
      const bestByBill = new Map<string, DashboardOccurrence>();
      for (const o of allOccurrences) {
        const billId = o.bills.id;
        const existing = bestByBill.get(billId);
        if (!existing) { bestByBill.set(billId, o); continue; }
        const pNew  = statePriority[o.state]   ?? 99;
        const pOld  = statePriority[existing.state] ?? 99;
        if (pNew < pOld || (pNew === pOld && (o.due_date ?? "") < (existing.due_date ?? ""))) {
          bestByBill.set(billId, o);
        }
      }

      // Categorize by actual due_date, not by state (state is updated hourly by cron)
      const today: DashboardOccurrence[] = [];
      const upcoming: DashboardOccurrence[] = [];
      const overdue: DashboardOccurrence[] = [];

      for (const o of bestByBill.values()) {
        if (o.state === "paid") continue;
        const cat = getOccurrenceCategory(o);
        if (cat === "overdue") overdue.push(o);
        else if (cat === "today") today.push(o);
        else upcoming.push(o);
      }

      // Recently paid: pick latest paid per bill, sorted by paid_at
      const paidByBill = new Map<string, DashboardOccurrence>();
      for (const o of allOccurrences) {
        if (o.state !== "paid") continue;
        const existing = paidByBill.get(o.bills.id);
        if (!existing || new Date(o.paid_at!).getTime() > new Date(existing.paid_at!).getTime()) {
          paidByBill.set(o.bills.id, o);
        }
      }
      const recentlyPaid = [...paidByBill.values()]
        .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
        .slice(0, 10);

      return { today, upcoming, overdue, recentlyPaid };
    },

    async fetchBillOccurrences(billId: string): Promise<BillOccurrence[]> {
      const { data, error } = await supabase
        .from("bill_occurrences")
        .select(OCCURRENCE_WITH_BILL)
        .eq("bill_id", billId)
        .is("deleted_at", null)
        .order("cycle_start", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as BillOccurrence[];
    },

    async fetchCurrentOccurrence(billId: string): Promise<BillOccurrence | null> {
      const { data } = await supabase
        .from("bill_occurrences")
        .select("*")
        .eq("bill_id", billId)
        .is("deleted_at", null)
        .in("state", ["upcoming", "generated", "expected_payment", "due_today", "overdue"])
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      return data as BillOccurrence | null;
    },

    // Mark paid (atomic: pay + cancel reminders) — next occurrence generation is
    // handled server-side by the occurrences_after_update_paid trigger (migration
    // 018) and the occurrence-generator edge function (daily cron).
    async markOccurrencePaid(input: MarkPaidInput): Promise<void> {
      const { error: occError } = await supabase.rpc("mark_occurrence_paid", {
        p_occurrence_id: input.occurrence_id,
        p_paid_at:       input.paid_at,
        p_paid_amount:   input.paid_amount || 0,
        p_payment_notes: input.payment_notes ?? null,
        p_receipt_path:  input.receipt_path ?? null,
        p_shift_anchor:  input.shift_anchor_to_payment ?? false
      });

      if (occError) throw new Error(occError.message);

      // Cancel all pending scheduled reminders for this occurrence
      const { error: remError } = await supabase
        .from("scheduled_reminders")
        .update({ status: "cancelled" })
        .eq("occurrence_id", input.occurrence_id)
        .eq("status", "pending");

      if (remError) {
        // Non-fatal — log but don't block the payment success
        console.warn("Failed to cancel reminders:", remError.message);
      }
    },

    // Delete transaction (soft delete + chain rebuild)
    async deleteOccurrenceTransaction(input: DeleteTransactionInput): Promise<void> {
      const { error } = await supabase.rpc("delete_occurrence_transaction", {
        p_occurrence_id: input.occurrence_id,
        p_anchor_action: input.anchor_action,
        p_custom_anchor: input.custom_anchor ?? null,
      });
      if (error) throw new Error(error.message);

      // Cancel all pending scheduled reminders for this occurrence
      const { error: remError } = await supabase
        .from("scheduled_reminders")
        .update({ status: "cancelled" })
        .eq("occurrence_id", input.occurrence_id)
        .eq("status", "pending");

      if (remError) {
        console.warn("Failed to cancel reminders after delete:", remError.message);
      }
    },
  };
}
