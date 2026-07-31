# Migration Rollback and Safety Notes

## 014_update_profiles
**Purpose:** Adds missing profile fields and enriches Google OAuth signups.
**Idempotency:** Yes, uses `ADD COLUMN IF NOT EXISTS` and `ON CONFLICT (id) DO NOTHING/UPDATE`.
**Safety:** Safe to run on existing databases. It uses `COALESCE` for display names to preserve any manual edits while backfilling missing fields for existing users.
**Rollback:**
```sql
ALTER TABLE public.profiles DROP COLUMN avatar_url, DROP COLUMN email, DROP COLUMN updated_at;
DROP FUNCTION public.update_profiles_updated_at CASCADE;
-- Trigger handle_new_user would need to be reverted manually to the previous signature.
```

## 015_fix_claim_pending_reminders
**Purpose:** Fixes a bug in the RPC where `bo.bill_id` was referenced without `bo` being in the FROM clause of the returning statement.
**Idempotency:** Yes, uses `CREATE OR REPLACE FUNCTION`.
**Safety:** Safe. It only changes the RPC body.
**Rollback:** Re-apply the old function definition from `013_claim_pending_reminders_rpc.sql` without the fix.

## 016_add_missing_indexes
**Purpose:** Adds indexes for foreign keys often joined in views or policies.
**Idempotency:** Yes, uses `CREATE INDEX IF NOT EXISTS`.
**Safety:** Safe, just builds indexes concurrently (if using concurrently, but standard create index is fast enough for empty/small DBs).
**Rollback:**
```sql
DROP INDEX public.categories_household_id_idx;
DROP INDEX public.notification_log_user_id_idx;
DROP INDEX public.household_members_household_id_idx;
DROP INDEX public.household_members_user_id_idx;
```
