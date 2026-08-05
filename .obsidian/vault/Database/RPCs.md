# RPCs

## generate_next_occurrence
```sql
-- Migration 049:9 (redefined by 051 canonical engine at 051:215 — canonical version is current)
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- Called by: triggers (INSERT/UPDATE on bills, UPDATE on occurrences)
-- Called by: occurrence-generator edge function
-- Uses: _anchor_day, _days_in_month, _snap_to_anchor
-- Filters: deleted_at IS NULL (migration 049)
```

## mark_occurrence_paid
```sql
-- Migration 046:8
CREATE OR REPLACE FUNCTION public.mark_occurrence_paid(
  p_occurrence_id uuid,
  p_paid_at timestamptz,
  p_paid_amount numeric,
  p_payment_notes text,
  p_receipt_path text,
  p_shift_anchor boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- Sets state='paid', paid_at, paid_amount, payment_notes, receipt_path
-- If p_shift_anchor=true: updates bills.anchor_date = p_paid_at::date
-- Then calls generate_next_occurrence
-- 054: when the paid cycle IS the selected next_due_date cycle, clears next_due_date (one-shot consumption)
```

## delete_occurrence_transaction
```sql
-- Migration 048:4
CREATE OR REPLACE FUNCTION public.delete_occurrence_transaction(
  p_occurrence_id uuid,
  p_anchor_action text,    -- 'keep'|'revert'|'custom'
  p_custom_anchor date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- 1. Lock occurrence (FOR UPDATE)
-- 2. Lock bill (FOR UPDATE)
-- 3. Soft-delete target (deleted_at = now())
-- 4. Cancel pending reminders
-- 5. Soft-delete future unpaid occurrences
-- 6. Cancel their reminders
-- 7. Handle anchor: keep / revert (to prev paid's paid_at or deleted's paid_at) / custom
-- 8. Call generate_next_occurrence
```

## claim_pending_reminders
```sql
-- Migration 015:4
CREATE OR REPLACE FUNCTION public.claim_pending_reminders()
RETURNS TABLE (id uuid, occurrence_id uuid, rule_id uuid, scheduled_for timestamptz,
               channel text, bill_id uuid, user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
-- FOR UPDATE SKIP LOCKED pattern
-- Processes up to 50 pending reminders where scheduled_for <= now()
-- Joins bill_occurrences → bills to get bill_id and user_id (created_by)
```

## preview_bill_occurrences
```sql
-- Migration 039:255
CREATE OR REPLACE FUNCTION public.preview_bill_occurrences(
  p_behavior_type text, p_repeat_kind text, p_repeat_interval int,
  p_due_day_offset int, p_anchor_date date
) RETURNS TABLE (cycle_start date, due_date date)
LANGUAGE plpgsql SECURITY DEFINER
-- Used by RecurrencePreview component
-- Generates next 3 occurrences for preview
```

## delete_account
```sql
-- Migration 017
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
-- Deletes profile, household members, auth user
```

## repair_all_occurrences
```sql
-- Migration 018:187
CREATE OR REPLACE FUNCTION public.repair_all_occurrences()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
-- Iterates all active bills, calls generate_next_occurrence for each
```
