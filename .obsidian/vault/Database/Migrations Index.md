# Migrations Index

> Full detail + deploy lessons: [[Database/Migrations]] · Schema: [[Database/Schema Overview]]

All 54 migrations in `app/supabase/migrations/`.

## Schema (001-012)
| # | Name | Purpose |
|---|------|---------|
| 001 | create_profiles | User profiles extending auth.users |
| 002 | create_households | Multi-user containers |
| 003 | create_categories | Per-household categories |
| 004 | create_bills | Recurring bill templates |
| 005 | create_bill_occurrences | Generated instances |
| 006 | create_reminder_rules | User reminder config |
| 007 | create_scheduled_reminders | Materialized reminders |
| 008 | create_notification_log | Audit log |
| 009 | create_push_tokens | Expo push tokens |
| 010 | create_audit_log | General audit |
| 011 | rls_policies | Row Level Security |
| 012 | seed_category_presets | Default categories |

## Engine v1 (013-027)
| # | Name | Purpose |
|---|------|---------|
| 013 | claim_pending_reminders_rpc | Lock-and-claim pattern |
| 014 | update_profiles | Profile updates |
| 015 | fix_claim_pending_reminders | Fix race condition |
| 016 | add_missing_indexes | Performance |
| 017 | delete_account_rpc | Account deletion |
| 018 | generate_occurrences | Initial engine + triggers |
| 019 | backfill_and_grants | Backfill data + permissions |
| 020 | fix_delete_account_cascade | Cascade deletes |
| 021 | fix_delete_account_auth_removal | Remove auth user |
| 022 | setup_cron_jobs | pg_cron scheduling |
| 023 | occurrence_state_machine | Auto state transitions |
| 024 | fix_duplicate_occurrences | Dedup logic |
| 025 | fix_occurrence_initial_state | Correct initial state |
| 026 | add_household_insert_policy | RLS fix |
| 027 | add_self_member_insert_policy | RLS fix |

## Engine v2 (028-045)
| # | Name | Purpose |
|---|------|---------|
| 028 | add_anchor_date | Universal anchor column |
| 029 | updated_occurrence_engine | Snap logic |
| 030 | fix_recurrence_updates | Update trigger + `_snap_to_anchor` |
| 031 | repair_existing_occurrences | Data repair |
| 032 | fix_prepaid_phase_offset | Phase offset |
| 033 | repair_prepaid_occurrences | Data repair |
| 034 | fix_recurrence_anchor_date | `_anchor_day` helper |
| 035 | simplify_prepaid_wallet | Simplify logic |
| 036 | fix_generate_next_occurrence_v2 | Anchor-date logic v2 |
| 037 | full_repair_all_occurrences | Full data repair |
| 038 | backfill_anchor_date_and_repair | Backfill data |
| 039 | unify_due_date_engine | Unified due date |
| 040 | repair_wrong_occurrences | Data repair |
| 041 | repair_wrong_occurrences_v2 | More repairs |
| 042 | update_payment_anchor | Anchor update logic |
| 043 | dont_skip_past_occurrences | Fix past skipping |
| 044 | fix_engine_and_past_dates | Past date fixes |
| 045 | fix_update_payment_anchor | Anchor update fix |

## Delete Transaction (046-050)
| # | Name | Purpose | Status |
|---|------|---------|--------|
| 046 | mark_paid_rpc | Mark paid RPC | Deployed |
| 047 | delete_transaction_rpc | Initial delete RPC + `deleted_at` column | Deployed |
| 048 | fix_delete_occurrence_transaction | Rewritten delete RPC | Deployed |
| 049 | fix_anchor_after_delete | Filter deleted rows, fix revert | Deployed |
| 050 | ensure_helper_functions | Create missing helpers | Deployed |

## Canonical Engine (051-054)
| # | Name | Purpose | Status |
|---|------|---------|--------|
| 051 | canonical_recurrence_engine | Single-source-of-truth helpers; MODE 1 incremental / MODE 2 rebuild; ROW_COUNT insert detection; 'none' bills materialize as overdue; 7-arg overload dropped | Deployed |
| 052 | repair_existing_data | Rebuild all active bills via MODE 2, cancel orphan reminders, dup self-check | Deployed |
| 053 | recurrence_regression_tests | SQL assert suite (A1-A9 helper math, B1-B4 engine behavior) — deploy gate | Deployed |
| 054 | next_due_control | `bills.next_due_date` chain-start override: skip branch (past+future), chain-building past selections, trigger on next_due_date, mark-paid consumption, C1-C6 regression | Deployed |

## Deploy Status

**Deployed**: 001-054 (all)

Run `cd app && npx supabase db push` to deploy pending migrations.
