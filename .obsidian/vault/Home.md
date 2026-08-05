# Home

```yaml
project: Bill Reminder
type: Expo RN + Supabase
owner: Suryadeep Banerjee
domain: billreminder.suryadeepbanerjee.in
supabase: https://dyhajmtfkjtwkijhptjx.supabase.co
email_from: billalert@billreminder.suryadeepbanerjee.in
last_updated: 2026-08-05
migrations_deployed: 54 / 54
typecheck: clean
```

## Quick Commands
```bash
cd app && npx tsc --noEmit          # typecheck (run after any code change)
cd app && npx expo start            # run app
cd app && npx supabase db push      # deploy migrations
cd app && npx supabase functions serve  # local edge functions
```

## Vault Index

| Note | What's In It |
|------|-------------|
| [[Daily Notes/Day 1 — Complete Project Build]] | Foundation → delete transaction → all fixes |
| [[Daily Notes/Day 2 - UI Hardening Pass]] | Today's UI-only pass (perf, guards, sanitization, visuals) |
| [[Daily Notes/Day 3 - Splash Tint, Household Deletion Feedback, Rename]] | Splash gold tint, delete-household reflection, rename, Action Guard, duplicate-notification fix |
| [[Architecture/Project Overview]] | Identity, tech stack, structure, env vars |
| [[Architecture/Tech Stack]] | Expo 54, NativeWind, Supabase, Zustand, React Query |
| [[Architecture/Project Structure]] | Every directory and its purpose |
| [[Architecture/Recurrence Engine]] | Algorithm, SQL, triggers, helpers, next_due_date |
| [[Architecture/Startup & Performance]] | Cold-start path, splash timing, render-perf rules |
| [[Architecture/Interaction Guarding]] | useTapGuard — double-tap protection, application matrix |
| [[Architecture/Input Sanitization & Error Safety]] | Zod trim + humanize() error pipeline |
| [[Architecture/Edge Functions]] | All 11 functions, auth, flow |
| [[Architecture/Key Patterns]] | Haptics, memo, optimistic updates, RLS, forms |
| [[Architecture/UI Components]] | Every component with props and behavior |
| [[Components/All]] | Compact component index |
| [[Hooks/All]] | Every hook with query keys |
| [[Lib/All]] | Supabase modules, errors, theme, utils, schemas |
| [[Database/Schema]] | All tables, columns, constraints (SQL form) |
| [[Database/Schema Overview]] | Same schema, friendly markdown form |
| [[Database/Migrations]] | All 54 with deploy status + lessons |
| [[Database/Migrations Index]] | One-line-per-migration quick index |
| [[Database/RPCs]] | All SQL functions with signatures |
| [[Features/Delete Transaction]] | Full pipeline with code |
| [[Features/Mark Paid]] | RPC + modal + anchor shift |
| [[Features/Email Notifications]] | Resend, template, invite flow |
| [[Features/Auth System]] | Supabase auth, households, RLS |
| [[Decisions/Decision Log]] | 17 architectural decisions (D001–D017) |
| [[Pending]] | What's left to do |

## Key Files (Fast Reference)

```
app/lib/supabase/client.ts:13         → Supabase client + SecureStore adapter (implicit flow)
app/lib/supabase/types.ts:1           → All TS types (mirrors DB exactly)
app/lib/supabase/bills.ts:12          → fetchBills, createBill (incl. next_due_date), updateBill, deleteBill
app/lib/supabase/occurrences.ts:37    → fetchDashboardData, markOccurrencePaid, deleteOccurrenceTransaction
app/lib/supabase/reminders.ts:10      → fetchSyncData, CRUD for bill_reminder_rules, defaultReminderRules
app/lib/supabase/profile.ts:5         → profile, households, members, invite, push token
app/lib/errors.ts:61                  → humanize() — the ONLY thing allowed to reach the user
app/lib/theme.ts:12                   → Colors, SemanticColors, tokens (accent #5B5BD6 / dark gold #D1A920)
app/lib/utils.ts:8                    → formatCurrency, resolveIcon (Lucide→Ionicons), date formatters
app/lib/notifications.ts:150          → listeners, syncLocalReminders (lazy-imported; push-token-aware — server owns push when token registered, local fallback otherwise)
app/stores/auth-store.ts:16           → Zustand auth state
app/stores/household-store.ts:23      → Zustand household state
app/stores/theme-store.ts:15          → Zustand theme mode (SecureStore)
app/hooks/useBills.ts:12              → useBills, useBill, useCreateBill, useUpdateBill, useDeleteBill
app/hooks/useOccurrences.ts:12        → useDashboard, useBillOccurrences, useCurrentOccurrence, useMarkPaid, useDeleteTransaction
app/hooks/useReminders.ts:11          → useReminderRules, useCreate/Update/Delete/ToggleReminderRule
app/hooks/useHousehold.ts:7           → useHousehold (React Query + Zustand)
app/hooks/useTapGuard.ts:16           → per-control double-tap guard (300 ms default)
app/schemas/bill.ts:53                → Zod create/update/markPaid + DUE_DATE_YEAR_MIN/MAX (2026–2035)
app/schemas/auth.ts:3                 → Zod auth schemas (trimmed)
app/app/_layout.tsx:50                → Root layout — splash timing, lazy notifications, providers
app/app/add-bill.tsx:350              → Create bill (3 steps, 1031 lines)
app/app/bill/[id].tsx:1               → Bill detail + edit sheet (931 lines)
app/app/(tabs)/dashboard/index.tsx:1  → Home screen (468 lines)
app/app/(tabs)/bills/index.tsx:40     → Bills list + search + filters (233 lines)
app/components/bills/                 → BillCard (memo), BillStateChip, MarkPaidModal, DeleteTransactionModal, RecurrencePreview
app/components/ui/                    → Button, Modal, TextInput, NumericInput, DayPicker, DateAnchorPicker, …
app/supabase/migrations/              → 54 SQL files (001–054, all deployed)
app/supabase/functions/               → 11 edge functions
```

## Bill Type System (quick recap)
- **Fixed Due Date** — Monthly (due_day_offset), Yearly, One-time. NO every_x_* kinds. Anchor never changes after creation.
- **Prepaid / Wallet** — Monthly, Yearly, Every X Days/Weeks/Months, One-time. `anchor_date` shifts with each payment; `anchor_month/day/year` are form-only.
- **`bills.next_due_date` (054)** — one-shot chain override: NULL = auto (first future cycle); SET = chain materializes from that cycle (past picks → overdue, whole chain in one call); paying the selected cycle consumes the override.
