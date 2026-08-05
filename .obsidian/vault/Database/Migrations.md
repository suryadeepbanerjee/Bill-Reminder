# Migrations

> Quick one-line index: [[Database/Migrations Index]] · Deploy with `cd app && npx supabase db push`

```yaml
location: app/supabase/migrations/
total: 54
deployed: 001-054 (all)
pending: none
deploy_command: cd app && npx supabase db push
```

## All 54

| # | File | Purpose | Status |
|---|------|---------|--------|
| 001 | create_profiles | profiles table | ✅ |
| 002 | create_households | households + household_members | ✅ |
| 003 | create_categories | categories table | ✅ |
| 004 | create_bills | bills table (21 columns at creation; + anchor_date 028; + next_due_date 054 = 23 today) | ✅ |
| 005 | create_bill_occurrences | occurrences + unique constraint | ✅ |
| 006 | create_reminder_rules | bill_reminder_rules | ✅ |
| 007 | create_scheduled_reminders | scheduled_reminders | ✅ |
| 008 | create_notification_log | notification_log | ✅ |
| 009 | create_push_tokens | push_tokens | ✅ |
| 010 | create_audit_log | audit_log | ✅ |
| 011 | rls_policies | Row Level Security on all tables | ✅ |
| 012 | seed_category_presets | 20+ default categories | ✅ |
| 013 | claim_pending_reminders_rpc | Lock-and-claim RPC (FOR UPDATE SKIP LOCKED) | ✅ |
| 014 | update_profiles | Profile update triggers | ✅ |
| 015 | fix_claim_pending_reminders | Fix returned columns | ✅ |
| 016 | add_missing_indexes | Performance indexes | ✅ |
| 017 | delete_account_rpc | Account deletion with cascade | ✅ |
| 018 | generate_occurrences | **Initial engine** + triggers (AFTER INSERT/UPDATE) | ✅ |
| 019 | backfill_and_grants | Backfill data + permissions | ✅ |
| 020 | fix_delete_account_cascade | Cascade delete fixes | ✅ |
| 021 | fix_delete_account_auth_removal | Remove auth.users on delete | ✅ |
| 022 | setup_cron_jobs | pg_cron: 4 edge jobs (daily 2AM / 15min / 5min / weekly Sun 3AM); the hourly state-machine job lives in 023 | ✅ |
| 023 | occurrence_state_machine | Auto state transitions (upcoming→generated→due_today→overdue) | ✅ |
| 024 | fix_duplicate_occurrences | Dedup logic | ✅ |
| 025 | fix_occurrence_initial_state | Correct initial state | ✅ |
| 026 | add_household_insert_policy | RLS: household insert | ✅ |
| 027 | add_self_member_insert_policy | RLS: self-member insert | ✅ |
| 028 | add_anchor_date | **anchor_date** column on bills | ✅ |
| 029 | updated_occurrence_engine | Snap logic + _snap_to_anchor | ✅ |
| 030 | fix_recurrence_updates | AFTER UPDATE trigger + _snap_to_anchor | ✅ |
| 031 | repair_existing_occurrences | Data repair | ✅ |
| 032 | fix_prepaid_phase_offset | Phase offset fix | ✅ |
| 033 | repair_prepaid_occurrences | Data repair | ✅ |
| 034 | fix_recurrence_anchor_date | **_anchor_day** helper + prepaid first-occ fix | ✅ |
| 035 | simplify_prepaid_wallet | Simplified logic (clobbered 034!) | ✅ |
| 036 | fix_generate_next_occurrence_v2 | v2: **_days_in_month**, yearly snap, skip past | ✅ |
| 037 | full_repair_all_occurrences | Full data repair | ✅ |
| 038 | backfill_anchor_date_and_repair | Backfill anchor_date | ✅ |
| 039 | unify_due_date_engine | Unified due date calculation | ✅ |
| 040 | repair_wrong_occurrences | Data repair | ✅ |
| 041 | repair_wrong_occurrences_v2 | More repairs | ✅ |
| 042 | update_payment_anchor | Anchor update logic | ✅ |
| 043 | dont_skip_past_occurrences | Fix past skipping | ✅ |
| 044 | fix_engine_and_past_dates | Past date fixes | ✅ |
| 045 | fix_update_payment_anchor | Anchor update fix | ✅ |
| 046 | mark_paid_rpc | **mark_occurrence_paid** RPC | ✅ |
| 047 | delete_transaction_rpc | **deleted_at** column + initial delete RPC | ✅ |
| 048 | fix_delete_occurrence_transaction | Rewritten delete RPC (soft-delete, reminders, chain rebuild) | ✅ |
| 049 | fix_anchor_after_delete | Filter deleted_at, fix revert fallback | ✅ |
| 050 | ensure_helper_functions | Create _anchor_day, _days_in_month, _snap_to_anchor | ✅ |
| 051 | canonical_recurrence_engine | **Canonical engine**: `_compute_next_cycle_start` + `_compute_bill_due_date` as single source of truth, MODE 1 (idempotent incremental) + MODE 2 (full rebuild), ROW_COUNT insert detection, 'none' bills materialize as overdue, 7-arg overload dropped | ✅ |
| 052 | repair_existing_data | Rebuild all active bills via MODE 2, cancel orphan reminders, self-check duplicate chains | ✅ |
| 053 | recurrence_regression_tests | SQL assert suite: anchor math, leap years, monthly snapping, every_x arithmetic, engine/preview parity, cron idempotency, MODE 2 rebuild, anchor-shift rebuild, mark-paid continuation | ✅ |
| 054 | next_due_control | **`bills.next_due_date`** (nullable chain-start override) + engine MODE 1/2 catch-up honors it (cycles before it skipped — past OR future), chain-builds past selections in one call, trigger fires on next_due_date edits, mark_occurrence_paid CONSUMES the override, regression C1-C6 | ✅ |

## Lessons Learned
- **035 clobbered 034**: 035 rewrote generate_next_occurrence without 034's _anchor_day logic
- **036 fixed 035**: Rewrote again with proper anchor_date support
- **044 returned NULL for prepaid one-time**: 7-arg overload's fallback broke one-time prepaid bills
- **051 loop bug (2×)**: after `INSERT ... ON CONFLICT DO NOTHING`, an `IF EXISTS` check matched the row just inserted → infinite forward-stepping (5000-row safety valve → years 2437/2443). Fixed by checking `GET DIAGNOSTICS v_inserted = ROW_COUNT` instead. **Fix was first applied to MODE 1 only** (edit tool replaced the first of two identical blocks) — push 2 failed B4d, debug dumps revealed the remaining MODE 2 loop, fixed and redeployed.
- **054 C4b (revive defeats skip)**: MODE 2's revive path resurrected a soft-deleted cycle that a future `next_due_date` should skip — the skip condition must cover FUTURE cycles before next_due_date, not just past ones (`(next IS NOT NULL AND cycle < next) OR (next IS NULL AND past AND not none)`). First attempt only skipped past cycles → C4b failed, fixed.
- **054 C5 (stale override gap)**: paying the selected cycle early (paid_at = today) shifted the anchor to today while the stale next_due_date kept blocking cycles → the chain jumped a cycle. Fix: mark_occurrence_paid clears next_due_date when the paid cycle IS the selected one (override is one-shot, consumed on payment).
- **Deploy recovery**: un-record a failed migration (`DELETE FROM supabase_migrations.schema_migrations WHERE version LIKE '%051%'`) then `db push` re-applies. 052 is idempotent (soft-delete → rebuild → revive-short-circuit) so re-runs are safe.
- **052's revive short-circuit**: MODE 2's `UPDATE ... WHERE deleted_at IS NOT NULL` + `IF FOUND THEN RETURN` is why 052 passed even with the buggy MODE 2 — rebuilt cycles matched left-over soft-deleted rows and returned before reaching the buggy insert block. B4d exposed it because an anchor edit changes the canonical cycle so revive misses.
