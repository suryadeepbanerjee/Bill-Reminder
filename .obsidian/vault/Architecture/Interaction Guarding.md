# Interaction Guarding

> Tap-debouncing for impatient fingers — without throttling deliberate use.
> Two layers: per-control `app/hooks/useTapGuard.ts` (D016) + the app-wide
> **Action Guard** (`app/lib/action-guard.ts`) for actions & navigation.

## Layer 1 — Per-Control Hook (`useTapGuard`)

```typescript
const guard = useTapGuard(300);   // interval in ms, default 300
// inside a handler:
if (!guard()) return;             // swallowed — no haptic, no action, no state change
```

- **Ref-based timestamp, not state** — the guard causes zero re-renders and survives re-renders (`useRef(0)` + `useCallback`).
- **Per-control instance** — each guard lives inside one component. Tapping a *different* control (another category, another date row) is never blocked; only repeats of the *same* control are.
- **Intervals are far below deliberate double-tap speed** (250–400 ms) → nothing a user actually intends is ever eaten.

### Application Matrix (Layer 1)

| Control | Interval | Why |
|---------|----------|-----|
| `CategoryItem` (add-bill step 1) | 300 ms | same-cell double-tap ignored; switching cells unaffected |
| `OptionButton` (behavior type, step 2) | 300 ms | same |
| `RepeatKindOption` (repeat kind, step 3) | 300 ms | same |
| `SelectablePreviewRow` (RecurrencePreview) | 250 ms | tap-again-to-**clear** toggle — a double-tap would select then instantly wipe the choice |
| Next / Back / Close (screen-level, add-bill) | 300 ms | no double step-jumps, no double-close, no haptic spam |
| Save bill (`onSubmit`) | 400 ms | **hard guard against duplicate bills** — two same-frame taps both submitted before the `loading` disable applied (state updates are async) |

## Layer 2 — Action Guard (`lib/action-guard.ts` + `lib/guarded-navigation.ts`)

Silent, **per-action** dedupe for anything that must never fire twice. Module-level
registry `Map<key, { inflight, lastFired }>`; key = action identity.

- **Silent**: never touches `disabled`/opacity/loading — the button feels instantly
  responsive; only the underlying action is deduped.
- **In-flight coalescing**: a repeat call while the first is running JOINS the first
  promise (callers reading the return value stay safe).
- **Cooldown 600 ms** after completion; in-flight hard-expires after 10 s.
- **Per-action scope**: `nav:push:bill/[id]:{"id":"1"}` vs `...:{"id":"2"}` are distinct.
  A then B is never blocked; two entry points to the SAME action share a key.
- **Blur reset**: root layout releases all in-flight locks on every `usePathname()`
  change — nothing leaks across screens or sticks.

### Central wiring — no per-button debounce

1. **Navigation — ALL of it**: `lib/guarded-navigation.ts` patches expo-router's
   `routingQueue.add` (the single funnel for `router.push/navigate/replace/back/
   dismiss/dismissAll`, `<Link>`, and `<Redirect>`). Key derived from the queued
   action: `nav:<type>:<screen>:<params>`. Same destination from different entry
   points (row + row-CTA, FAB + empty state) dedupes; different destinations never
   block each other. Imported once from `app/_layout.tsx`.
2. **Mutations — at the data chokepoint**: `lib/supabase/*.ts` wrap write fns with
   `guardAsync(key, fn)` — keys: `mut:mark-paid:<occurrence_id>`,
   `mut:create-bill:<json-input>`, `mut:delete-tx:<occurrence_id>`,
   `mut:delete-household:<id>`, invites/removes/renames, reminder CRUD, accept-invite.
   Every hook (`useMarkPaid`, `useCreateBill`, …) and every direct call site is
   covered with zero caller changes.
3. **Manual wiring**: `useGuardedCallback(key, fn)` hook + optional `guardKey` prop
   on shared `Button`/`IconButton` (silent wrap, holds the lock while the handler's
   promise is pending). Auth submits already have `loading`+`disabled` so they need
   no guardKey.

### Design rules

1. **Guard before haptics** — a swallowed tap must not buzz.
2. **Per-action keys, never one global lock** — rapid A→B sequences must work.
3. **Don't guard idempotent pickers** (MonthPicker, YearPicker chips, search input) — last-wins is already safe; guarding only adds latency.
4. **A guard supplements, never replaces, `loading`/`disabled`** — those cover long async work; the guard covers the same-tick window before the re-render lands.

## Related
- [[Architecture/Startup & Performance]]
- [[Architecture/Input Sanitization & Error Safety]]
- [[Architecture/UI Components]]
