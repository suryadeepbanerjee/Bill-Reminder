// ── Database row types ────────────────────────────────────────────────────────
// Mirrors the Supabase schema exactly. Never cast or widen these.

export type BehaviorType = "fixed_due_date" | "prepaid_validity" | "wallet_balance";
export type RepeatKind   = "monthly" | "yearly" | "every_x_days" | "every_x_weeks" | "every_x_months" | "none";
export type OccurrenceState = "upcoming" | "generated" | "expected_payment" | "due_today" | "overdue" | "paid" | "archived";
export type ReminderAnchor  = "generation" | "expected_payment" | "due_date";
export type ReminderChannel = "push" | "email" | "both";
export type HouseholdRole   = "admin" | "editor" | "viewer";

export interface Profile {
  id:           string;
  display_name: string | null;
  created_at:   string;
}

export interface Household {
  id:         string;
  name:       string;
  created_by: string | null;
  created_at: string;
}

export interface HouseholdMember {
  id:           string;
  household_id: string;
  user_id:      string | null;
  invited_email?: string | null;
  role:         HouseholdRole;
  status:       "invited" | "active" | "removed";
  created_at:   string;
}

export interface CategoryPreset {
  id:    string;
  key:   string;
  name:  string;
  icon:  string;
  color: string;
}

export interface Category {
  id:           string;
  household_id: string;
  preset_key:   string | null;
  name:         string;
  icon:         string;
  color:        string;
  created_at:   string;
}

export interface Bill {
  id:                       string;
  household_id:             string;
  category_id:              string;
  title:                    string;
  provider_name:            string | null;
  behavior_type:            BehaviorType;
  amount_expected:          number | null;
  currency:                 string;
  repeat_kind:              RepeatKind;
  repeat_interval:          number | null;
  generation_day_offset:    number | null;
  expected_payment_day_offset: number | null;
  due_day_offset:           number | null;
  validity_days:            number | null;
  check_interval_days:      number | null;
  minimum_balance:          number | null;
  balance_notes:            string | null;
  is_active:                boolean;
  created_by:               string | null;
  created_at:               string;
  updated_at:               string;
  // Joined
  categories?:              Category;
}

export interface BillOccurrence {
  id:                   string;
  bill_id:              string;
  cycle_start:          string;
  generation_date:      string | null;
  expected_payment_date: string | null;
  due_date:             string | null;
  state:                OccurrenceState;
  amount:               number | null;
  paid_at:              string | null;
  paid_amount:          number | null;
  payment_notes:        string | null;
  receipt_path:         string | null;
  created_at:           string;
  updated_at:           string;
  // Joined
  bills?:               Bill;
}

export interface BillReminderRule {
  id:                    string;
  bill_id:               string;
  anchor:                ReminderAnchor;
  offset_days:           number;
  repeat_interval_hours: number | null;
  repeat_cap:            number | null;
  channel:               ReminderChannel;
  enabled:               boolean;
}

export interface ScheduledReminder {
  id:            string;
  occurrence_id: string;
  rule_id:       string;
  scheduled_for: string;
  channel:       "push" | "email";
  status:        "pending" | "sent" | "skipped" | "failed" | "cancelled";
  sent_at:       string | null;
}

export interface PushToken {
  id:              string;
  user_id:         string;
  expo_push_token: string;
  device_label:    string | null;
  created_at:      string;
  last_used_at:    string;
}

// ── Dashboard-specific aggregated type ──────────────────────────────────────

export interface DashboardOccurrence extends BillOccurrence {
  bills: Bill & {
    categories: Category;
  };
}

// ── Create/Update input types (stripped of server-generated fields) ──────────

export type CreateBillInput = Omit<Bill,
  "id" | "created_at" | "updated_at" | "categories"
>;

export type UpdateBillInput = Partial<Omit<Bill,
  "id" | "household_id" | "created_at" | "updated_at" | "categories"
>>;

export interface MarkPaidInput {
  occurrence_id:  string;
  paid_amount:    number;
  paid_at:        string;
  payment_notes?: string | null;
  receipt_path?:  string | null;
}
