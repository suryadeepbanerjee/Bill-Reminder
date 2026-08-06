-- Migration: 019_backfill_and_grants
-- Description: One-time backfill of missing bill_occurrences for bills created
--              before the auto-generation trigger existed (018), plus explicit
--              grants so the delete-account and occurrence RPCs are callable
--              by logged-in users. Safe to run multiple times.

-- 1. Explicit grants (belt-and-suspenders — Postgres grants EXECUTE to PUBLIC
--    by default on new functions, but some hosted Supabase projects have
--    altered default privileges, which silently breaks RPC calls from the
--    client with a generic "permission denied" error).
grant execute on function public.delete_user_account() to authenticated;
grant execute on function public.generate_next_occurrence(uuid) to authenticated;
grant execute on function public.repair_all_occurrences() to authenticated;

-- 2. Backfill: generate the missing first occurrence for any active bill
--    that has none yet (i.e. bills created before migration 018's insert
--    trigger existed). This is exactly why bills created earlier show
--    "no bill" on the dashboard — the dashboard reads from
--    bill_occurrences, not from bills directly.
select public.repair_all_occurrences();
