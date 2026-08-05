# Startup & Performance

> Cold-start path, render-perf rules, and the UI-only hardening pass (Aug 5, 2026).
> Every fix is invisible — no screen was visually changed; only speed, stability, and memory.

## Cold-Start Path (`app/app/_layout.tsx` — 134 lines)

| Step | Work | Async cost |
|------|------|-----------|
| 1 | Splash visible (`splash-icon.png`, bg `#080810`) | — |
| 2 | First React frame paints → `SplashScreen.hideAsync()` + 200 ms fade | none |
| 3 | `LoadingScreen` (identical `#080810` bg + spinner) shown while auth restores | — |
| 4 | `supabase.auth.getSession()` → SecureStore read (+ token refresh if expired) | storage / network |
| 5 | Session known → redirect to `(auth)` or enter `(tabs)` | — |
| 6 | `syncLocalReminders()` — lazy import, only when a session exists | network |

Rules that keep step 2 fast:

1. **No eager native modules.** `lib/notifications.ts` (expo-notifications) is lazy-imported inside a `useEffect`; its native module no longer initializes during cold start. The listener effect uses a `mounted` flag + captured `unsubscribe` for safe cleanup.
2. **Splash hides on the first painted frame**, not after `getSession()`. The LoadingScreen behind it shares the same `#080810` bg, so the handoff is invisible to the user.
3. **`SplashScreen.setOptions({ duration: 200, fade: true })`** — crossfade instead of a hard cut (expo-splash-screen ≥ 31).
4. **Parallel async**: theme hydrate (SecureStore read) and session restore run concurrently; neither awaits the other.
5. `queryClient` is module-level — one instance, survives renders.

## Render-Perf Rules

1. **`memo` the row component, then keep its props stable** — otherwise memo is dead weight.
   - `BillCard` is `memo`-wrapped (`components/bills/BillCard.tsx:35`).
   - `app/(tabs)/bills/index.tsx` — `renderItem` is `useCallback`-stable (`[occurrenceByBillId, openMarkPaid]`). Previously an inline renderItem created fresh `onPress`/`onMarkPaid` closures on every render, so every search keystroke and refetch re-rendered every visible row.
   - Dashboard sections `MemoizedUnlimitedSection` / `MemoizedCappedSection` (`app/(tabs)/dashboard/index.tsx`) are `memo`-wrapped; handlers `openBill`, `goToBills`, `noop` are stable `useCallback`s; `actionRequired` is `useMemo`d. Rows now re-render only when query data changes — not on toast/modal state churn.
2. **FlatList tuning** (bills list): `removeClippedSubviews`, `maxToRenderPerBatch={8}`, `windowSize={7}`, `initialNumToRender={6}`.
3. **Dashboard stays a ScrollView by design** — action-required is unlimited but typically small; upcoming capped at 5, recently paid at 3. A FlatList + header refactor would risk visual change for no measurable win at household scale.
4. **New function identity = re-render.** Never inline `() => {}` or `() => router.push(...)` into a memoized child; hoist with `useCallback` (a `noop` singleton for no-ops).

## Cost Inventory (verified this pass)

| Item | Before | After |
|------|--------|-------|
| expo-notifications native init | at cold start (static import) | after first paint (lazy import) |
| Splash hold | until `getSession()` resolves | first frame + 200 ms fade |
| Bills rows re-render | every parent render | only when item/occurrence data changes |
| Dashboard rows re-render | every render (toast, modal) | only on query data change |

## Related
- [[Architecture/Interaction Guarding]]
- [[Architecture/Input Sanitization & Error Safety]]
- [[Database/Migrations]] — 054 is the engine-side counterpart (next_due_date)
- [[Daily Notes/Day 2 - UI Hardening Pass]]
