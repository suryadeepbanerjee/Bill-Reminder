# AGENTS.md — Bill Reminder Project

## Project Identity
- **Name**: Bill Reminder
- **Type**: Expo React Native mobile app + Supabase backend + landing website
- **Owner**: Suryadeep Banerjee
- **Domain**: billreminder.suryadeepbanerjee.in

## For AI Assistants

This file tells you everything you need to know to continue working on this project.
Read the `.obsidian/vault/` notes for deep context on any topic.

## Quick Commands

```bash
# Typecheck (run after any code change)
cd app && npx tsc --noEmit

# Run app locally
cd app && npx expo start

# Deploy migrations
cd app && npx supabase db push

# Run Supabase functions locally
cd app && npx supabase functions serve
```

## Tech Stack

- **Mobile**: Expo SDK 54, expo-router, NativeWind, React Query, Zustand
- **Backend**: Supabase (PostgreSQL, Edge Functions, pg_cron, pg_net)
- **Auth**: Supabase Auth with `double_confirm_changes = true`
- **Email**: Resend API via Edge Functions
- **Landing**: React + Vite (in `/website`)

## Key Conventions

- **Forms**: React Hook Form + Zod schemas (in `app/schemas/`) — schemas `.trim()` strings (title, provider, payment_notes, email, displayName); validation runs on trimmed values
- **Styling**: NativeWind classes, dark mode via CSS variables
- **State**: Zustand for auth (`stores/auth-store.ts`), React Query for server data
- **Components**: Functional, memoized where needed, haptic feedback on interactions
- **Tap guards**: `hooks/useTapGuard.ts` (ref-based, per-control, 250–400 ms) — apply to any control where a double-tap could double-submit or toggle-away a selection; guard BEFORE haptics; never use a shared guard across controls
- **Errors**: every user-facing error must pass `humanize()`/`friendlyError()` from `lib/errors.ts` — never show raw `e.message`
- **Cold start**: never statically import `lib/notifications.ts` (or other native modules) on the cold-start path — lazy-import in effects
- **Render perf**: list `renderItem` must be `useCallback`-stable; don't inline closures into memoized children (hoist `useCallback`, `noop` singleton for no-ops)
- **Database**: `SECURITY DEFINER` for RPCs, `FOR UPDATE` for concurrency
- **Types**: `app/lib/supabase/types.ts` mirrors DB schema exactly

## Project Structure

- `app/app/` — All screens (expo-router file-based routing)
- `app/components/bills/` — BillCard, BillStateChip, DeleteTransactionModal, MarkPaidModal
- `app/components/ui/` — Modal, Button, IconButton, AlertBadge, DateAnchorPicker
- `app/hooks/` — useBills, useOccurrences, useReminders, useHousehold
- `app/lib/supabase/` — bills.ts, occurrences.ts, reminders.ts, client.ts, types.ts
- `app/stores/` — auth-store.ts, household-store.ts
- `app/schemas/` — Zod validation schemas
- `app/supabase/migrations/` — 54 SQL migration files (001-054, all deployed)
- `app/supabase/functions/` — 7 edge functions

## Database

- **Project URL**: `https://dyhajmtfkjtwkijhptjx.supabase.co`
- **Email from**: `billalert@billreminder.suryadeepbanerjee.in`
- **Tables**: profiles, households, household_members, categories, category_presets, bills, bill_occurrences, bill_reminder_rules, scheduled_reminders, push_tokens, notification_log, audit_log
- **Key RPCs**: generate_next_occurrence, mark_occurrence_paid, delete_occurrence_transaction, claim_pending_reminders, preview_bill_occurrences

## Bill Type System

### Fixed Due Date
- Monthly (due_day_offset), Yearly, One-time
- NO every_x_* repeat kinds
- Anchor never changes after creation

### Prepaid/Wallet
- Monthly, Yearly, Every X Days/Weeks/Months, One-time
- `anchor_date` shifts with each payment
- `anchor_month`/`anchor_day`/`anchor_year` are form-only (not DB columns)
- `anchor_date` (DATE) is the actual DB column

## Pending Work

1. **Verify splash-timing change on device**: splash now hides on first frame (LoadingScreen bg is identical `#080810`); typecheck-clean, not verified on hardware
2. **Test delete flow**: End-to-end test of delete transaction with chain rebuild
3. **Push notifications on Android**: Firebase configured but pipeline not verified
4. **Swipe between tabs**: Gesture conflicts with expo-router (low priority)
5. **Year-horizon cleanup** (low): `YearPicker.tsx` hardcodes 2020–2027 defaults; should read from `DUE_DATE_YEAR_MIN/MAX` in `schemas/bill.ts`

## Migration Status

- All 54 migrations deployed (`cd app && npx supabase db push` is up to date)
- 051 = canonical recurrence engine (MODE 1 incremental / MODE 2 rebuild, ROW_COUNT insert detection, helpers as single source of truth)
- 052 = live data repair; 053 = SQL regression suite (deploy gate — `db push` fails if invariants break)
- 054 = `bills.next_due_date` override (chain-start control): NULL = auto (next future), SET = materialize from that cycle (past picks → overdue rows, whole chain in one call); skip branch covers future cycles before a set next_due_date; paying the selected cycle consumes the override; UI: tappable RecurrencePreview rows in add/edit bill
- If a migration fails mid-push: un-record it (`DELETE FROM supabase_migrations.schema_migrations WHERE version LIKE '%NNN%'`) and re-push; 052 is idempotent
- Local `supabase db query --linked -f file.sql` for one-off SQL (shell eats inline `$$`; API suppresses NOTICE output — end scripts with a SELECT/CTE)

## Vault Reference

Read `.obsidian/vault/Home.md` for navigation to all project knowledge.
The vault contains: daily notes, architecture docs, database schema, feature specs, and decision log.
