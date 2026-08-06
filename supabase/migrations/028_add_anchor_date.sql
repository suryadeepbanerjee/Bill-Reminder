-- Migration: 028_add_anchor_date
-- Description: Add anchor_date column to bills table.
--              Powers yearly fixed-due-date, one-time bills, and
--              start-date anchoring for prepaid/wallet bills.
-- Backward compatible: existing rows receive NULL; engine falls back to
--                      created_at-based logic when anchor_date IS NULL.

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS anchor_date date;

COMMENT ON COLUMN public.bills.anchor_date IS
  'Optional anchor date for recurrence computation.
   Semantics by (behavior_type, repeat_kind):
     fixed_due_date + monthly   → NULL (engine uses due_day_offset)
     fixed_due_date + yearly    → Target month/day for annual recurrence (year is ignored by engine)
     fixed_due_date + none      → Exact one-time due date
     prepaid_validity + monthly → First payment date (month+day matter; year used for first cycle)
     prepaid_validity + yearly  → Annual payment anchor
     prepaid_validity + every_x_* → First cycle start (full date)
     prepaid_validity + none    → Exact one-time date
     wallet_balance + *         → Same semantics as prepaid_validity above';
