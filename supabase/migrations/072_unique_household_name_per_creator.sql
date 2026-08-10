-- Migration: 072_unique_household_name_per_creator
-- Description: One account cannot own two households with the same name.
--
-- Unique index on (created_by, lower(name)) with a comment explaining the
-- intent. Names are trimmed before insert/rename (both app and web), so
-- lower(name) is sufficient; the case-insensitive uniqueness matches the
-- prechecks in the create-household edge function and the UI.
--
-- PostgreSQL unique indexes treat NULLs as distinct, so legacy rows whose
-- creator deleted their account (created_by IS NULL) never collide here.
-- Verified against live data: no duplicate (created_by, lower(name)) pairs
-- exist, so this index creates cleanly.
--
-- NOTE: transfer-ownership updates households.created_by (migrations 064/065).
-- If a transfer would leave the new owner holding two households with the
-- same name, this index rejects it — same invariant as creation.

create unique index if not exists households_created_by_name_key
  on public.households (created_by, lower(name));