-- Migration: 059_tighten_audit_log_insert_policy
-- Description: Close the `with check (true)` INSERT policy on audit_log (B3.4).
--
-- The old policy let ANY authenticated user insert rows into audit_log with
-- an arbitrary household_id — audit-log forgery / cross-household spam.
-- Audit entries are written by Edge Functions (service_role, bypasses RLS);
-- end users only need to READ their household's log. Replacing the open
-- insert with a membership-scoped check (defense-in-depth; the real writer
-- is service_role anyway).
--
-- notification_log note: it never had an INSERT policy (011 only defines a
-- SELECT policy), so user inserts are already blocked by RLS-by-default —
-- no change needed there.

drop policy if exists "system writes audit log"
  on public.audit_log;

create policy "members write own household audit log"
  on public.audit_log for insert
  with check (public.is_household_member(household_id));
