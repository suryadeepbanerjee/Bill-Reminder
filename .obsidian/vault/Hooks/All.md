# Hooks

> Every hook in `app/hooks/` with its query key and mutation behavior.
> Line numbers = `export function` line. All hooks are thin wrappers over React Query
> unless noted.

## Data Hooks

| Hook | File:line | Query key / mutation | Notes |
|------|-----------|----------------------|-------|
| `useBills` | useBills.ts:12 | `["bills", householdId]` | householdId read from household-store |
| `useBill` | useBills.ts:23 | `["bill", billId]` | |
| `useCreateBill` | useBills.ts:31 | mutation | invalidates `bills`, `dashboard` |
| `useUpdateBill` | useBills.ts:44 | mutation | also engine-rebuild trigger |
| `useDeleteBill` | useBills.ts:60 | mutation | |
| `useDashboard` | useOccurrences.ts:12 | `["dashboard", householdId]` | 4 buckets: today / overdue / upcoming / recentlyPaid |
| `useBillOccurrences` | useOccurrences.ts:24 | `["occurrences", billId]` | |
| `useCurrentOccurrence` | useOccurrences.ts:32 | `["currentOccurrence", billId]` | hero in bill detail |
| `useMarkPaid` | useOccurrences.ts:40 | mutation | optimistic update w/ snapshot rollback |
| `useDeleteTransaction` | useOccurrences.ts:87 | mutation | calls `delete_occurrence_transaction` RPC |
| `useReminderRules` | useReminders.ts:11 | `["reminderRules", billId]` | |
| `useCreateReminderRule` | useReminders.ts:19 | mutation | |
| `useUpdateReminderRule` | useReminders.ts:30 | mutation | |
| `useDeleteReminderRule` | useReminders.ts:45 | mutation | |
| `useToggleReminderRule` | useReminders.ts:56 | mutation | |
| `useProfile` | useProfile.ts:5 | `["profile", userId]` | |
| `useUpdateProfile` | useProfile.ts:16 | mutation | |
| `useHousehold` | useHousehold.ts:7 | `["households", userId]` | hydrates household-store |
| `useCategoryPresets` | useCategories.ts:5 | `["categoryPresets"]` | |
| `useHouseholdCategories` | useCategories.ts:13 | `["categories", householdId]` | |
| `useRecurrencePreview` | useRecurrencePreview.ts:57 | `["preview", params]` | calls `preview_bill_occurrences` RPC; disabled when params null |

## UI Hooks

| Hook | File:line | Purpose |
|------|-----------|---------|
| `useTapGuard(ms?)` | useTapGuard.ts:16 | per-control double-tap guard → see [[Architecture/Interaction Guarding]] |
| `useGuardedCallback(key, fn, opts?)` | useGuardedCallback.ts:1 | wraps any sync/async callback with an action-guard key; releases on settle |
| `useToast` | useToast.ts:18 | toast state: `{ toast, showToast, onDismiss }` |

## Formatters (non-hooks, exported from hooks)
- `buildPreviewParams(...)` — useRecurrencePreview.ts:79 — builds RPC params from form fields.

## Related
- [[Architecture/Key Patterns]] — query key + cache invalidation patterns
- [[Lib/All]]
- [[Home]]
