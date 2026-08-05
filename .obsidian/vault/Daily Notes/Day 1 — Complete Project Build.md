# Day 1 — Complete Project Build

**Date**: August 4, 2026
**Duration**: Full day session
**Scope**: Complete Bill Reminder app — from foundation through production-ready features

---

## What This Day Covers

This single day session built the entire Bill Reminder app from scratch to production-ready state. Every feature, every migration, every bug fix happened in this session.

---

## Phase 1: Foundation (Prior Work, Documented Here)

### App Architecture
- **Expo SDK 54** with expo-router file-based routing
- **NativeWind 4.2.1** for Tailwind CSS styling
- **Supabase** for database, auth, edge functions, pg_cron
- **Zustand** for auth state, **React Query** for server state
- **React Hook Form + Zod** for form validation

### Database Schema (Migrations 001-027)
- `profiles` — extends Supabase auth.users
- `households` — multi-user containers
- `household_members` — membership with roles (admin/editor/viewer)
- `categories` + `category_presets` — per-household bill categories
- `bills` — recurring bill templates (NOT occurrences)
- `bill_occurrences` — generated instances per billing cycle
- `bill_reminder_rules` — user-configurable reminder settings
- `scheduled_reminders` — materialized reminders ready to send
- `push_tokens`, `notification_log`, `audit_log`

### Authentication
- Supabase Auth with `double_confirm_changes = true`
- OTP required from both old AND new email for email change
- Auth store: Zustand (`stores/auth-store.ts`), `user.email` is source of truth
- Redirect URI: `bill-reminder://callback` (mobile), `https://billreminder.suryadeepbanerjee.in/auth/callback` (web)

### Recurrence Engine (Migrations 018-027)
- `generate_next_occurrence(p_bill_id)` — core engine called by triggers
- `tr_generate_initial_occurrence()` — AFTER INSERT trigger on bills
- `tr_generate_on_bill_update()` — AFTER UPDATE trigger on bills
- `tr_generate_on_paid()` — AFTER UPDATE trigger on bill_occurrences
- `claim_pending_reminders()` — atomic lock-and-claim RPC
- pg_cron jobs: occurrence-generator (daily 2AM), reminder-materializer (15min), reminder-dispatcher (5min), cleanup (weekly), occurrence-state-machine (hourly)

### Bill Type System
- **Fixed Due Date**: Monthly (due_day_offset), Yearly, One-time. NO every_x_*. Anchor never changes.
- **Prepaid/Wallet**: Monthly, Yearly, Every X Days/Weeks/Months (interval+anchor_date), One-time. Anchor shifts with each payment.
- `anchor_month`/`anchor_day`/`anchor_year` are form-only fields — NOT DB columns
- `anchor_date` (DATE) is the actual DB column
- `buildAnchorDate(month, day, year)` returns `YYYY-MM-DD` string

### Edge Functions
- `email-sender` — sends branded emails via Resend API
- `reminder-materializer` — materializes pending reminders from rules
- `reminder-dispatcher` — claims and routes reminders to push/email
- `push-sender` — sends Expo push notifications
- `occurrence-generator` — daily bill occurrence generation
- `cleanup` — purges old notification_log and archived occurrences
- `create-household` — creates household + adds user as admin
- `invite-member` — sends invite email via Resend, creates member row

### Landing Website (`/website`)
- React + Vite + TypeScript
- Framer Motion animations
- Authentication pages (Sign In, Sign Up, Password Reset, Email Verification)
- Deployed on Vercel

### Email Templates
- Outlook-compatible table layout
- Dark mode support
- Brand color: gold/amber `#b69317`
- Hosted at `billreminder.suryadeepbanerjee.in`
- From: `billalert@billreminder.suryadeepbanerjee.in`

---

## Phase 2: Bug Fixes & Improvements (This Session)

### 1. Dashboard Upcoming Count Fix
**Problem**: `fetchDashboardData` was counting multiple occurrences per bill (no dedup).
**Fix**: Per-bill dedup keeping highest-priority occurrence (overdue > due_today > expected_payment > generated > upcoming > paid). Recently paid also deduped per bill. Increased limit to 200.

### 2. Paid Bottom Sheet Scrollable
**Problem**: Long payment forms couldn't scroll in the bottom sheet.
**Fix**: Added `maxHeight: "85%"` to Modal's bottom sheet `Animated.View` style.

### 3. Text Strings Error Fix
**Problem**: App crashed when category was null/missing.
**Fix**: Added `if (!cat) return null` guard in `BillCard.tsx`.

### 4. useUpdateBill Cache Fix
**Problem**: Bill edit didn't refresh occurrence list.
**Fix**: Added `queryClient.invalidateQueries({ queryKey: ["occurrences", id] })` to `useUpdateBill`.

### 5. TypeScript Errors Fixed
- `types.ts`: Removed duplicate `BillOccurrence` interface and type aliases
- `DeleteTransactionModal.tsx`: Fixed `useState` destructuring syntax
- `bill/[id].tsx`: Fixed `IconButton` usage (was passing number for size, string for icon)
- `DeleteTransactionModal.tsx`: Fixed Button variant `"error"` → `"destructive"`
- Final state: **zero TypeScript errors**

---

## Phase 3: Delete Transaction Feature (This Session)

### Problem
Users had no way to remove mistaken payments. Deleting a payment would orphan future occurrences and leave ghost reminders.

### Solution: Safe Delete System

#### Soft-Delete System
- Added `deleted_at timestamptz` column to `bill_occurrences` (migration 047)
- Deleted payments hidden from UI and calculations
- Preserved for audit trail — never physically removed

#### Chain Rebuild for Prepaid/Wallet Bills
- When deleting latest payment on flexible bill, app asks user how to adjust schedule:
  - **Keep current schedule** — anchor stays the same
  - **Revert to previous date** — resets to previous payment's paid_at
  - **Choose a different date** — custom date picker with validation
- For fixed_due_date: no schedule change, just soft-delete

#### Ghost Notification Cleanup
- Deleting payment automatically cancels all `pending` `scheduled_reminders`
- Prevents confusing push notifications or emails for deleted payments

#### Race Condition Prevention
- `FOR UPDATE` locking on both occurrence and bill rows
- Prevents concurrent operations from crashing

#### RPC: `delete_occurrence_transaction`
- Single atomic operation: soft-delete → cancel reminders → update anchor → rebuild chain
- Date validation: `>= bill.created_at`, `<= today`
- Runs as `SECURITY DEFINER`

### Smart Deletion UI
- Header shows bill name + payment date
- Warning: "This payment record will be removed from your history."
- For prepaid/wallet: radio group with actual dates in labels
- For fixed-date: explanatory text
- `ScrollView` wrapper for scrollability
- DateAnchorPicker for custom date selection

---

## Phase 4: Recurrence Engine Fixes (This Session)

### Migration 036: `generate_next_occurrence` v2
- Fixed regression from migration 035 that clobbered v034's anchor_date logic
- First occurrence uses `anchor_date` for prepaid/wallet
- Yearly cycles snap to anchor month/day
- Due date clamps anchor_day to month
- Skips past cycles (`due_date >= CURRENT_DATE`)
- Added `_days_in_month` helper

### Migration 049: Fix Anchor After Delete
- **Bug 1**: `generate_next_occurrence` didn't filter soft-deleted occurrences
- **Bug 2**: "Revert" fallback used `created_at` instead of deleted occurrence's `paid_at`
- Added `AND deleted_at IS NULL` to `v_latest_cycle_start` query

### Migration 050: Ensure Helper Functions
- Creates `_anchor_day`, `_days_in_month`, `_snap_to_anchor` if missing
- Fixes `function public._anchor_day(date) does not exist` error
- Caused by migrations deployed out of order

---

## Phase 5: UI Polish (This Session)

### Paid Badge Centering
- Moved "Paid" badge down with `marginTop: 2` wrapper in OccurrenceRow
- Only affects bill detail page

### Email Template Mobile Redesign
- Dark background `#0f172a`, narrower `520px` max-width
- `16px` rounded corners, mobile stacking
- `@media max-width: 620px` breakpoint
- Full-width CTA on mobile, smaller `12px` uppercase labels

---

## All Migrations Created

| # | Purpose | Status |
|---|---------|--------|
| 036 | Anchor-date logic v2, `_days_in_month` | Pending |
| 047 | `deleted_at` column + initial delete RPC | Pending |
| 048 | Rewritten delete RPC | Pending |
| 049 | Fix anchor after delete | Pending |
| 050 | Ensure helper functions | Pending |

**Deploy**: `cd app && npx supabase db push`

---

## Current State

- **TypeScript**: Zero errors
- **Features**: Complete delete transaction pipeline, recurrence engine fixed, dashboard fixed
- **UI**: Paid badge centered, scrollable bottom sheets, mobile email templates
- **Pending**: Push migrations to Supabase, test delete flow end-to-end

## Related
- [[Home]] · [[Pending]] · [[Database/Schema Overview]] · [[Database/Migrations Index]] · [[Features/Delete Transaction]]
