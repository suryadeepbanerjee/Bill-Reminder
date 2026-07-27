# Recurring Bill & Subscription Tracker — Technical Specification

Prepared by: PM / UX / Mobile Architecture / DB / Security review pass, scoped for a solo build on free-tier infrastructure, to be handed to Antigravity as an implementation prompt.

---

## 0. Scope Decision — Read This First

The original brief asks for an enterprise-grade multi-tenant SaaS (households, roles, audit logs, dual-channel notifications, offline sync, receipt uploads) built by one person on free infrastructure. That combination is fine **if sequenced correctly** and dangerous if built all at once. Decisions locked in for this spec:

| Capability | MVP (v1) | Phase 2 | Phase 3 |
|---|---|---|---|
| Single-user bill tracking, categories, reminders, payment history | ✅ | | |
| Push notifications (Expo) | ✅ | | |
| Email digest (Resend, capped) | ✅ | | |
| Offline create/edit + sync | ✅ | | |
| Receipt photo upload | ✅ | | |
| Household schema (DB only, no UI) | ✅ (schema exists, single-member household auto-created per user) | | |
| Household invites, multi-member, roles UI | | ✅ | |
| Shared bill editing, activity feed | | ✅ | |
| CSV export | | | ✅ |
| Web/desktop client | | | ✅ |

Rationale: shipping single-user first means your riskiest surface (cross-household RLS correctness) gets validated against real usage before you add the second user. The database is designed for multi-tenancy from day one so this isn't a rewrite later — just a UI + policy activation.

---

## 1. Product Requirements

### 1.1 Problem statement
People miss or overpay recurring obligations (subscriptions, EMIs, recharges, utility bills) because they're scattered across SMS, email, apps, and memory. The product is a single glanceable ledger of everything recurring, with reminders tuned to *when the user can actually act* (not just the due date).

### 1.2 Personas
- **Primary: The self-manager.** Tracks 10–25 recurring items personally. Wants zero-maintenance reminders and a fast "mark paid" action. This is the only persona MVP needs to fully satisfy.
- **Secondary (Phase 2): The household coordinator.** Wants visibility into shared bills (rent, broadband, electricity) without chasing family members over text.
- **Edge persona: The prepaid tracker.** Cares more about "when do I need to recharge before service cuts off" than calendar due dates — this is a distinct mental model from postpaid bills and must not be forced into a "due date" UI.

### 1.3 Functional requirements — MVP
- Auth: email+password, magic link, email verification required before first use, forgot password.
- CRUD for bills across three behavior types: **fixed due-date** (credit card, EMI, rent, insurance), **prepaid/validity** (recharges — no due date, validity-day countdown), **wallet/balance** (electricity/gas prepaid meters — periodic balance check, no due date).
- Category presets with icon + color (list from original brief), plus custom categories.
- Reminder rules per bill, anchored to generation date / expected payment date / due date, each independently toggleable.
- Push notifications; email notifications default to important milestone reminders (generation day, expected payment day, due date, overdue). Users may optionally enable email for every reminder or disable email entirely. Both channels are governed by a shared rate-limit-aware dispatcher.
- Dashboard: today's schedule, upcoming (7/30 day), overdue, recently paid, next reminder.
- Mark Paid: amount, date, notes, optional receipt photo → auto-generates next occurrence per repeat rule.
- Timeline per bill: past occurrences, reminders sent, payments.
- Search + filter (category, state, provider, date range).
- Offline create/edit of bills and mark-paid actions, synced on reconnect.

### 1.4 Functional requirements — Phase 2
- Household creation, invite by email, roles (admin/editor/viewer), shared bill visibility, per-household activity feed, permission-gated writes.

### 1.5 Non-functional requirements
- P95 screen transition < 150ms on mid-range Android (2021+ hardware).
- Cold start < 2.5s.
- All Supabase interactions go through RLS — no client ever trusted for authorization.
- WCAG 2.1 AA contrast and touch-target sizing.
- DB stays under ~350MB in normal use (500MB free-tier cap) — enforced via retention policy on notification/audit logs (Section 8).

### 1.6 Explicit non-goals (v1)
- No bank/SMS auto-detection of bills (privacy + complexity; a real feature, but not v1).
- No budgeting/analytics beyond simple totals — this is a tracker, not a finance app, per the brief's own design goal.
- No web client.
- No investment/loan interest calculations — track payment obligations, not model interest amortization.

---

## 2. Information Architecture

**Tab structure:** Dashboard · Bills (list/search) · Add (modal, not a tab) · Timeline/Activity · Settings.

**Core flows:**
1. *Add bill* → pick category → category determines which dynamic fields render (see 1.3 behavior types) → set reminder rules (sane defaults pre-filled, all editable) → save.
2. *Reminder received* → deep link straight to the bill's Mark Paid sheet, not just the app home screen.
3. *Mark paid* → amount/date/notes/receipt → occurrence closes → next occurrence silently generated → all pending reminders for the closed occurrence are cancelled immediately (this must be atomic with the paid-write, see Section 5).
4. *Offline edit* → local optimistic update, queued mutation, background sync icon, conflict surfaced only if a genuine conflict occurs (rare in single-user; matters more in Phase 2).

---

## 3. Data Model Concept — Definition vs. Occurrence

A **bill** is the recurring rule (title, category, repeat rule, reminder rules). A **bill_occurrence** is one billing cycle instance and is where the state machine (`upcoming → generated → expected_payment → due_today → overdue → paid → archived`) actually lives. This separation is what makes "timeline per bill," "payment history," and "past vs. future reminders" possible without data loss on repeat. The original brief conflates these; this is the fix.

For prepaid/validity bills, `due_date` is null and `expected_payment_date`/state transitions are driven by `validity_days` from the last recharge instead.

---

## 4. Database Schema (PostgreSQL / Supabase)

```sql
-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ============ HOUSEHOLDS ============
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('admin','editor','viewer')),
  status text not null default 'active' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Every user gets a personal household auto-created at signup (trigger below).
-- Phase 2 invite UI just adds more members to it, or lets a user create additional households.

-- ============ CATEGORIES ============
create table category_presets ( -- global, seeded, read-only via RLS (public select, no writes)
  id uuid primary key default gen_random_uuid(),
  key text unique not null,        -- 'credit_card', 'mobile_recharge', ...
  name text not null,
  icon text not null,
  color text not null
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  preset_key text references category_presets(key),  -- null if fully custom
  name text not null,
  icon text not null,
  color text not null,
  created_at timestamptz not null default now()
);

-- ============ BILLS (template) ============
create table bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id),
  title text not null check (char_length(title) between 1 and 120),
  provider_name text check (char_length(provider_name) <= 80),
  behavior_type text not null check (behavior_type in ('fixed_due_date','prepaid_validity','wallet_balance')),
  amount_expected numeric(12,2) check (amount_expected is null or amount_expected >= 0),
  currency text not null default 'INR',
  repeat_kind text not null check (repeat_kind in ('monthly','yearly','every_x_days','every_x_weeks','every_x_months','none')),
  repeat_interval int check (repeat_interval is null or repeat_interval > 0),
  -- fixed_due_date specifics
  generation_day_offset int,        -- days relative to cycle start
  expected_payment_day_offset int,
  due_day_offset int,
  -- prepaid_validity specifics
  validity_days int,
  -- wallet_balance specifics
  check_interval_days int,
  minimum_balance numeric(12,2),
  balance_notes text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ BILL OCCURRENCES (instance / state machine) ============
create table bill_occurrences (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  cycle_start date not null,
  generation_date date,
  expected_payment_date date,
  due_date date,
  state text not null default 'upcoming'
    check (state in ('upcoming','generated','expected_payment','due_today','overdue','paid','archived')),
  amount numeric(12,2),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_notes text check (char_length(payment_notes) <= 1000),
  receipt_path text,   -- storage object path, never a public URL
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, cycle_start)
);

-- ============ REMINDER RULES (per bill, configurable) ============
create table bill_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  anchor text not null check (anchor in ('generation','expected_payment','due_date')),
  offset_days int not null default 0,        -- negative = before, 0 = on the day, positive = after
  repeat_interval_hours int check (repeat_interval_hours is null or repeat_interval_hours >= 6),
  repeat_cap int check (repeat_cap is null or repeat_cap between 1 and 8), -- hard ceiling, see Section 5
  channel text not null default 'push' check (channel in ('push','email','both')),
  enabled boolean not null default true
);

-- ============ SCHEDULED REMINDERS (materialized queue — idempotent) ============
create table scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references bill_occurrences(id) on delete cascade,
  rule_id uuid not null references bill_reminder_rules(id) on delete cascade,
  scheduled_for timestamptz not null,
  channel text not null check (channel in ('push','email')),
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed','cancelled')),
  sent_at timestamptz,
  unique (occurrence_id, rule_id, scheduled_for, channel)
);

-- ============ NOTIFICATION LOG (audit trail) ============
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  scheduled_reminder_id uuid references scheduled_reminders(id) on delete set null,
  user_id uuid references profiles(id),
  channel text not null,
  provider_message_id text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
-- retention: purged after 90 days by cleanup Edge Function (Section 8) to protect the 500MB cap.

-- ============ PUSH TOKENS ============
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  expo_push_token text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

-- ============ AUDIT LOG ============
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,          -- 'bill.create', 'bill.mark_paid', 'member.invite', ...
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
-- No IP addresses, no raw device identifiers. If IP-based abuse detection is ever needed, store a salted hash, not the raw IP.

-- ============ INDEXES ============
create index on bill_occurrences (bill_id, state);
create index on bill_occurrences (due_date) where state not in ('paid','archived');
create index on scheduled_reminders (status, scheduled_for) where status = 'pending';
create index on bills (household_id, is_active);
create index on audit_log (household_id, created_at desc);
```

### 4.1 RLS pattern

```sql
create or replace function is_household_member(hh uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hh and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function household_role(hh uuid) returns text
language sql security definer stable as $$
  select role from household_members
  where household_id = hh and user_id = auth.uid() and status = 'active';
$$;

alter table bills enable row level security;
create policy "members read bills" on bills for select using (is_household_member(household_id));
create policy "editors write bills" on bills for insert with check (
  is_household_member(household_id) and household_role(household_id) in ('admin','editor')
);
create policy "editors update bills" on bills for update using (
  is_household_member(household_id) and household_role(household_id) in ('admin','editor')
);
create policy "admins delete bills" on bills for delete using (household_role(household_id) = 'admin');
```

Apply the identical four-policy pattern to `categories`, `bill_occurrences` (via join to `bills.household_id`), `bill_reminder_rules` (via join), and `audit_log` (read-only, admin-scoped). `scheduled_reminders` and `notification_log` are never directly writable by clients — only by Edge Functions using the service role key, with RLS still enabled and a read-only policy scoped to the owning user for the "timeline" view.

**Every table above gets RLS enabled with no exceptions**, including lookup tables — `category_presets` is the only public-read, zero-write table in the schema (writes come from migrations only).

---

## 5. Reminder Engine Design

Anchors: `generation`, `expected_payment`, `due_date`. Each `bill_reminder_rules` row fires at `anchor_date + offset_days`, at a fixed local time (default 9:00 AM device-local, user-configurable in Settings).

**Escalation cap (this replaces the brief's "every 6 hours" default):** `repeat_interval_hours` and `repeat_cap` exist so a user *can* opt into aggressive escalation on a specific bill (e.g. a real due-date-day rent reminder), but:
- Minimum interval is 6 hours (DB constraint) but **default is null** (fires once).
- `repeat_cap` hard-limits total repeats to 8 regardless of what's configured — this is a server-side ceiling, not just a UI suggestion, enforced in the scheduler function.
- Any reminder still pending when the occurrence transitions to `paid` is cancelled in the same transaction as the mark-paid write (`UPDATE scheduled_reminders SET status='cancelled' WHERE occurrence_id = $1 AND status='pending'` inside the same RPC that writes the payment).

**Idempotency:** the unique constraint on `(occurrence_id, rule_id, scheduled_for, channel)` means the materializer can run as often as needed without ever double-inserting. The dispatcher claims rows atomically:
```sql
update scheduled_reminders
set status = 'sent', sent_at = now()
where id = $1 and status = 'pending'
returning *;
```
If this returns zero rows, another dispatcher invocation already claimed it — no double-send, no distributed lock needed.

**Email strategy:** Email defaults to important milestone reminders rather than high-frequency reminders. Users may choose:
- Important milestones only (recommended)
- Every reminder
- Never

**Email cap protection:** before sending an individual email, the dispatcher checks a per-user daily send counter (derived from `notification_log`, channel='email', created today). If the household would exceed ~80 emails/day (buffer under Resend's 100/day cap), remaining reminders for that day are collapsed into a single digest email instead of sent individually. Push has no such cap and is treated as the primary channel; email is explicitly secondary.

---

## 6. Notification Architecture

**Edge Functions:**

| Function | Trigger | Responsibility |
|---|---|---|
| `occurrence-generator` | pg_cron, daily | For every active bill, ensure the next occurrence exists (rolling window); computes generation/expected/due dates from repeat rule. |
| `reminder-materializer` | pg_cron, every 15 min | Reads `bill_reminder_rules` + open occurrences, inserts due `scheduled_reminders` rows (idempotent via unique constraint). |
| `reminder-dispatcher` | pg_cron, every 5 min | Claims pending reminders (atomic UPDATE above), routes to push-sender or email-sender, applies the email cap logic. |
| `push-sender` | called by dispatcher | Calls Expo Push API, writes `notification_log`. |
| `email-sender` | called by dispatcher | Calls Resend API, writes `notification_log`. |
| `cleanup` | pg_cron, weekly | Purges `notification_log` > 90 days, archives `bill_occurrences` in `archived` state > 1 year old to keep the 500MB DB cap manageable. |
| `keepalive` | external cron (GitHub Actions, every 5 days) | Lightweight authenticated `select 1` to prevent the 7-day free-tier project pause. **Not optional** — see critique above. |

State transitions (`upcoming → generated → expected_payment → due_today → overdue`) are computed by a scheduled SQL function comparing `now()` to the occurrence's dates — not by the client — so the state is always server-authoritative.

---

## 7. Offline & Sync Design

React Query and Zustand cache server state and UI state respectively — neither queues writes made while offline. Add:
- **Local persistence:** `expo-sqlite` mirroring the shape of `bills`, `bill_occurrences`, categories for read access offline.
- **Outbox pattern:** offline mutations (create bill, mark paid, edit reminder rule) are appended to a local `pending_mutations` table with a client-generated UUID and `created_at`. On reconnect, mutations replay in order against Supabase.
- **Conflict resolution:** last-write-wins by `updated_at`, except `mark_paid`, which is idempotent by occurrence id and never conflicts in single-user mode. In Phase 2 (shared households), a genuine conflict (two members mark-paid offline simultaneously) surfaces a merge prompt rather than silently picking one — data loss on a payment record is unacceptable.
- **Duplicate reminder prevention while offline:** reminders are always server-computed (Section 5), never client-scheduled, so offline state can't create duplicate reminders — it can only delay a user *seeing* one until reconnect (local notifications from Expo can still fire from a previously-synced schedule if you choose to mirror scheduled_reminders locally; recommend not doing this in v1 to avoid a second source of truth).

---

## 8. Security Audit

| Surface | Real risk here? | Mitigation |
|---|---|---|
| Account takeover / credential stuffing | Yes | Supabase Auth's built-in rate limiting on auth endpoints; enforce a modern password policy (min 12 chars, no composition-rule theater); enable leaked-password protection in Supabase Auth settings if available on your plan; require email verification before first bill can be created. |
| Session hijacking / token theft | Yes | Short-lived access JWT + refresh rotation (Supabase default); store tokens in secure storage (`expo-secure-store`), never AsyncStorage; "sign out everywhere" revokes refresh tokens. |
| Email enumeration | Yes | Identical response text/timing for "forgot password" and "sign up" regardless of whether the email exists. |
| CSRF | **No — not applicable.** Mobile client uses bearer tokens, not cookies. Listed in the original brief but not a real attack surface for this architecture; not spending effort here. |
| IDOR / cross-household data access | Yes — highest real risk in this app | RLS on every table (Section 4.1) as the actual enforcement layer; UUID (not sequential) primary keys everywhere; every Edge Function re-checks membership server-side rather than trusting the JWT claims alone. |
| SQL injection | Low with correct usage | Supabase client / PostgREST use parameterized queries by construction; Edge Functions must use the query builder or parameterized `pg` calls, never string-concatenated SQL. |
| XSS | Low, but present | React Native doesn't render raw HTML by default — the actual risk is a "notes" or "provider name" field later rendered via a markdown/HTML renderer. Rule: render all user text as plain text, never `dangerouslySetInnerHTML`-equivalent, unless explicitly sanitized. |
| XXE | **No — not applicable.** No XML parser anywhere in this stack. Removed from the checklist rather than padded with a fake mitigation. |
| SSRF | **No, currently.** No feature fetches a user-supplied URL server-side. Flag for re-review only if a link-preview or favicon feature is added later. |
| CSV injection | **No, currently** — no export feature in MVP. If added in Phase 3, prefix cells starting with `=+-@` with a leading `'` before writing. |
| File upload (receipts) | Yes | Validate MIME type **and** magic bytes (not just extension); cap at 5MB; store under a randomized UUID path in a **private** Supabase Storage bucket; serve via short-lived signed URLs scoped to the requesting user's household; strip EXIF/GPS metadata on upload (receipt photos can leak location); reject any executable/script extension outright. |
| Rate limiting on custom endpoints | Yes, and currently unaddressed by the stack | Supabase only rate-limits its own Auth endpoints — your custom Edge Functions get no free rate limiting. Implement a simple Postgres-table sliding-window counter (per user, per IP) checked at the top of any Edge Function that's expensive or abusable (invites, reminder rule creation). |
| Notification abuse / duplicate sends | Yes | Idempotent unique constraint + atomic claim pattern (Section 5); email cap logic (Section 5). |
| Secrets exposure | Yes | Resend API key and Supabase service-role key live only in Edge Function environment variables, never in the Expo client bundle; `.env` files excluded from version control; anon key (public by design) is the only key shipped client-side. |
| Audit log privacy | Yes | No raw IP addresses or device fingerprints logged; if abuse detection ever needs IP data, store a salted hash, not the raw value. |
| Data minimization | Yes | Household members see other members' names and bill data by design (that's the feature) but never see each other's auth email addresses unless explicitly shared — use `display_name`, not `email`, in any shared UI. |

**What was deliberately cut from the original security checklist and why:** XXE and CSRF are removed as active line items because there is no code path in this architecture that could be exploited by either — including them anyway is checklist security, not threat-modeled security, and it dilutes attention from the two surfaces that actually matter here: RLS correctness and rate limiting on custom functions.

---

## 9. Design System

**Primary reference: Things 3's information density + Linear's typography and motion restraint.** (The brief cited five references; five different apps pulling in different directions produces an incoherent system — picking a primary anchor is a decision, not a compromise.)

- **Type scale:** 28/22/17/15/13 px for Display/Title/Body/Label/Caption, one font family (system font — SF Pro / Roboto — no custom font load cost), tabular figures for all amounts.
- **Spacing scale:** 4/8/12/16/24/32/48 (4px base unit).
- **Radius scale:** 8px (cards), 6px (inputs/buttons), 999px (pills/badges only).
- **Color:** neutral gray scale (10 steps) as the base; a single accent hue for primary actions; state is communicated via **icon + label text**, not saturated color blocks — e.g. overdue = a small warning glyph and "3 days overdue" label in default text color, not a red card.
- **Elevation:** two levels only — resting (no shadow, 1px hairline border) and raised (subtle 1-2px shadow for modals/sheets). No colored shadows, no glow.
- **Motion:** 150-200ms ease-out for all transitions, no bounce/spring effects, no animated gradients.
- **States:** every list/detail screen needs an explicit empty state, loading skeleton, and error state before it ships — not retrofitted.

---

## 10. Folder Structure & Architecture

```
app/                        # Expo Router
  (auth)/
  (tabs)/
    dashboard/
    bills/
    add/
    settings/
  bill/[id].tsx
components/
  ui/                       # design-system primitives
  bills/
  reminders/
lib/
  supabase/                 # client, generated types
  offline/                  # sqlite mirror, outbox, sync engine
  reminders/                # client-side display logic only (all scheduling is server-side)
stores/                     # zustand
hooks/                      # react-query hooks
schemas/                    # zod schemas, shared between client validation and Edge Function validation
supabase/
  migrations/
  functions/
    occurrence-generator/
    reminder-materializer/
    reminder-dispatcher/
    push-sender/
    email-sender/
    cleanup/
```

---

## 11. Antigravity Implementation Prompt

*(Copy everything below this line into Antigravity as the build prompt.)*

---

You are building a React Native (Expo) + TypeScript mobile app: a personal recurring-bill and subscription tracker. Build in the phased order below — do not skip ahead to Phase 2+ features until Phase 1 is fully working and tested.

**Stack:** Expo + Expo Router, TypeScript, NativeWind, React Query, Zustand, React Hook Form + Zod, Supabase (Postgres + Auth + Edge Functions + Storage), Resend, Expo Notifications, expo-sqlite, expo-secure-store.

**Non-negotiable constraints:**
- Every Supabase table gets Row Level Security enabled with no exceptions. Never rely on client-side checks for authorization.
- All input validated with Zod on the client **and** re-validated inside every Edge Function — never trust client validation alone.
- Never put the Supabase service-role key or the Resend API key anywhere in client code. They exist only in Edge Function environment variables.
- Every user-writable text field is rendered as plain text in the UI, never through any HTML/markdown renderer with raw injection risk.
- All money fields use `numeric`, never floating point, both in Postgres and in client math.
- Reminder scheduling is 100% server-computed (pg_cron + Edge Functions). The client never locally schedules a notification from its own logic — it only displays what the server has scheduled.

**Phase 1 — Foundation**
1. Scaffold the Expo Router app with the folder structure in Section 10. Set up Supabase project, apply the full schema from Section 4 as ordered migrations (respect FK dependency order: profiles → households → household_members → categories → bills → bill_occurrences → bill_reminder_rules → scheduled_reminders → notification_log → push_tokens → audit_log). Seed `category_presets` with the categories listed in the original brief (Credit Card, Mobile Recharge, Broadband, Electricity, Water, Gas, Insurance, EMI, Rent, Loan, OTT, Music, Cloud Services, Hosting, Domain, Education, Gym, Health, Investments, Subscriptions, Other), each with an icon and color.
2. Implement the RLS policy pattern from Section 4.1 across every household-scoped table.
3. Auth: email/password + magic link, email verification gate, forgot password, secure token storage via expo-secure-store. On signup, a trigger auto-creates a personal household and an 'admin' `household_members` row for that user — this is what lets Phase 2 attach without a schema change.

**Phase 2 — Core bill CRUD (single-user)**
4. Build Add/Edit Bill with the three behavior types (fixed_due_date, prepaid_validity, wallet_balance) — the form must dynamically show only the fields relevant to the selected behavior type, per Section 1.3.
5. Build the Dashboard (today's schedule, upcoming, overdue, recent activity, next reminder) and Bills list with search/filter (category, state, provider, date range).
6. Build Mark Paid flow (amount, date, notes, optional receipt photo via Supabase Storage with the hardening rules in Section 8) as a single atomic RPC that: writes the payment, transitions the occurrence to `paid`, cancels pending `scheduled_reminders` for that occurrence, and generates the next occurrence per the repeat rule.
7. Build the per-bill Timeline view (past occurrences, reminders sent, payment history).

**Phase 3 — Reminder engine + notifications**
8. Implement the Edge Functions in Section 6's table, deployed and scheduled via pg_cron as specified.
9. Implement the reminder rule editor UI (per-bill, anchor + offset + optional repeat with the hard cap from Section 5) with sensible single-fire defaults pre-filled.
10. Implement push registration (Expo push token → `push_tokens` table). Implement configurable email preferences (Important Milestones, Every Reminder, Never). Push remains the primary high-frequency notification channel.
11. Implement the `keepalive` mechanism (Section 6) as an external scheduled job — document exactly how to set it up, since it lives outside the app itself.

**Phase 4 — Offline + sync**
12. Implement the expo-sqlite mirror and outbox/mutation-queue pattern from Section 7. Test explicitly: create a bill offline, mark a bill paid offline, reconnect, verify no duplicate reminders and no data loss.

**Phase 5 — Household (Phase 2 product scope — build only after Phases 1-4 are stable)**
13. Build invite-by-email, role assignment UI, shared bill visibility, and the household activity feed, governed entirely by the RLS policies already in the schema — this phase should require no schema changes, only UI and policy activation.

**Phase 6 — Polish**
14. Empty/loading/error/skeleton states for every screen (Section 9). Dark mode + light mode. Accessibility pass (contrast, touch targets, screen reader labels). Run through the full Security Audit table in Section 8 as a literal checklist before considering this production-ready.

**Testing strategy:** unit tests for reminder date-math (anchor + offset calculations, repeat rule next-occurrence calculation) since these are the highest-value-of-correctness, easiest-to-get-subtly-wrong logic in the app; integration tests for the mark-paid RPC's atomicity; manual RLS testing with two real test accounts in two different households to confirm zero cross-tenant access before Phase 5 ships.

**Definition of done for v1 (MVP):** a single user can sign up, verify email, add bills across all three behavior types, receive correctly-timed push and digest-email reminders that stop the instant a bill is marked paid, use the app fully offline with reliable sync, and every table in the schema has been manually verified to reject a cross-household access attempt.


---

## 9.1 Additional UX Enhancements

### Snooze
Every reminder notification should support quick actions:
- Mark Paid
- Snooze 2 Hours
- Snooze Tomorrow
- Snooze 3 Days
- Custom Snooze

Snoozing only postpones the current reminder instance. It must not modify the recurring schedule.

### Provider Templates
Include predefined providers (e.g. Airtel, Jio, SBI Card, HDFC Card, Netflix, Prime Video, WBSEDCL) that prefill sensible defaults such as category, behavior type, repeat rule, and suggested reminder settings. Users may edit all fields before saving.

### Backup & Restore
Support:
- Export JSON
- Import JSON
- CSV export (Phase 3)

### Recurrence Override
Allow a one-cycle override that changes dates only for the current occurrence without permanently modifying the recurring rule.
