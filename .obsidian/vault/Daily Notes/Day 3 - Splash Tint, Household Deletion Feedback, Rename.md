# Day 3 — Splash Tint, Household Deletion Feedback, Rename

**Date**: Aug 5, 2026 · **Scope**: UI only — no backend changes

## 1. Splash Buffer → Theme Gold
- `LoadingScreen` spinner changed `Colors.accent[500]` (indigo `#5B5BD6` — the "bluish"
  buffer) → **gold `#D1A920`** (dark-theme accent), bg stays `#080810` for seamless
  splash handoff. `Colors` import removed from `_layout.tsx`.

## 2. Delete Household — Immediate Reflection + Loading Buffer
- **Bug**: after deleting a household in Manage Members, settings/home showed it until a
  manual refresh. Root cause: the deletion updated the Zustand store only — the React
  Query cache (`["households", user.id]`, staleTime 5 min) was never invalidated, unlike
  every other mutation hook in the codebase (`useBills`, `useOccurrences`, etc.).
- **Fix** (`members.tsx` delete handler): after success, invalidate
  `["households", user.id]`, `["bills", targetId]`, `["dashboard", targetId]`,
  `["householdCategories", targetId]` → `useHousehold.queryFn` re-syncs the store from
  fresh server data. Removed the immediate `router.back()` so the user **sees** the
  household vanish from "Your Households" + Danger Zone in place. Added a full-screen
  gold-spinner overlay ("Deleting household…") while the request runs + success haptic.

## 3. Rename
- "Manage Members" → **"Manage Household"** (Stack.Screen title, `members.tsx`).
  Route file/name unchanged (`members.tsx`).

## 4. Action Guard — silent per-action duplicate-tap dedupe
- **Problem**: rapid multi-taps opened the same screen 2–3× or re-fired the same
  mutation (double mark-paid, double delete) — impatient-tap UX bug.
- **Layer 1 — navigation, fully central**: `lib/guarded-navigation.ts` patches
  expo-router's `routingQueue.add` — the single funnel for `router.*`, `<Link>`,
  `<Redirect>`. Key = `nav:<type>:<screen>:<params>` → same destination deduped
  (incl. from different entry points), different destinations unaffected.
- **Layer 2 — mutations, at the data chokepoint**: write fns in
  `lib/supabase/{bills,occurrences,reminders,profile}.ts` wrapped in
  `guardAsync(key, fn)` (cooldown 600 ms + in-flight promise coalescing — repeat
  calls join the first, so return-value consumers like add-bill stay safe).
- **Reusable pieces**: `lib/action-guard.ts` registry; `hooks/useGuardedCallback.ts`;
  optional `guardKey` prop on shared `Button`/`IconButton`.
- **Blur reset**: `_layout.tsx` releases in-flight locks on every pathname change.
- Full spec: [[Architecture/Interaction Guarding]]

## 5. Duplicate Notification Fix (`lib/notifications.ts` only)
- **Bug**: user reported 2 reminders arriving for the same bill while server pushes
  arrive fine. Root cause: **two pipelines both delivered push-type reminders** —
  the server (materializer → dispatcher → push-sender, every 5 min) sends an Expo
  push for every `push`/`both` rule, AND the app independently scheduled a **local**
  notification for the same rules via `syncLocalReminders`. Token registered → 1
  server push + 1 local = duplicate. (A second, race-based duplication: 11
  fire-and-forget call sites in `_layout.tsx` / `useBills` / `useOccurrences` /
  `useReminders` could run concurrently and double-schedule on the same snapshot.)
- **Fix** — all inside `lib/notifications.ts`:
  1. **Server owns push when a token exists**: `syncLocalReminders` queries
     `push_tokens` for the user (RLS-legal). If a row exists, `desired` stays empty
     and the existing diff **cancels** any local notifications — push arrives once,
     from the server. No token (dev builds without EAS project ID) → local fallback
     still schedules, so reminders keep working.
  2. **Serialized syncs**: runs are queued (`syncQueue` promise chain) so
     same-tick triggers can't both schedule the same reminder.
  3. **One actionable occurrence per bill** (local fallback): keeps only the most
     urgent occurrence per bill (`OCCURRENCE_PRIORITY`: overdue 0 → upcoming 4),
     so leftover chain rows (old overdue + next cycle) can't emit a second track.
- **Not changed**: backend/edge functions untouched (constraint); `both`-channel
  rules still send push + email by design.
- **Caveat (server-side, known)**: the materializer iterates **all** open
  occurrences per bill, so a bill with an unresolved overdue row + next cycle can
  still push twice from the server — dedupe only guards the client. If duplicates
  persist after this fix, the server loop is the next suspect (separate task).

## Verifications
- `npx tsc --noEmit` — clean.
- No on-device run — Pending #1 (also verify gold spinner + delete overlay on device).
- Duplicate fix itself needs device verification (Pending #1b): with token → single
  server push, no local; without token → single local fallback.

## Related
- [[Home]] · [[Pending]] · [[Architecture/Startup & Performance]] · [[Lib/All]]
