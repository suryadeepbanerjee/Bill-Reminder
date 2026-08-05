# Decision Log

## D001: Soft Delete Over Hard Delete
**Date**: Aug 4, 2026
**Context**: Users need to remove mistaken payments, but financial history must be preserved.
**Decision**: Use `deleted_at` timestamp column (soft delete) instead of physically removing rows.
**Rationale**: Audit trail, financial integrity, ability to undo. Deleted records hidden from UI and queries via `WHERE deleted_at IS NULL`.

## D002: Anchor-Based Recurrence
**Date**: Aug 4, 2026
**Context**: Prepaid/wallet bills need flexible scheduling based on actual payment dates.
**Decision**: Use `anchor_date` column as the reference point for all recurrence calculations.
**Rationale**: Allows the chain to shift when payments are made early/late. Fixed-date bills don't use anchor for scheduling (only for display).

## D003: Single RPC for Delete Transaction
**Date**: Aug 4, 2026
**Context**: Delete operation involves multiple steps: soft-delete, reminder cleanup, anchor update, chain rebuild.
**Decision**: Implement as a single PostgreSQL RPC (`delete_occurrence_transaction`) with `FOR UPDATE` locking.
**Rationale**: Atomicity — all steps succeed or none do. Locking prevents race conditions between concurrent operations.

## D004: Revert Uses Paid_at Not Cycle_start
**Date**: Aug 4, 2026
**Context**: When deleting the only paid occurrence, "revert" should use the payment date, not the cycle start date.
**Decision**: Use `paid_at` date of the deleted occurrence as the revert anchor when no previous paid exists.
**Rationale**: The user set the cycle from when they actually paid. Using cycle_start would recreate the old chain, not restart from the payment.

## D005: Filter Deleted in generate_next_occurrence
**Date**: Aug 4, 2026
**Context**: After soft-deleting occurrences, the engine was still computing next cycle from deleted rows.
**Decision**: Add `AND deleted_at IS NULL` to the `v_latest_cycle_start` query.
**Rationale**: Ensures the engine falls back to `anchor_date` when all occurrences are deleted, giving the correct restart point.

## D006: NativeWind Over StyleSheet
**Date**: Project inception
**Context**: Need consistent styling across React Native.
**Decision**: Use NativeWind (Tailwind CSS for RN).
**Rationale**: Faster development, consistent design system, dark mode support via CSS variables.

## D007: Zustand for Auth, React Query for Data
**Date**: Project inception
**Context**: Need state management for auth and server data.
**Decision**: Zustand for auth state, React Query for server state.
**Rationale**: Zustand is lightweight for auth. React Query handles caching, refetching, and optimistic updates for API data.

## D008: pg_cron Over Client-Side Scheduling
**Date**: Migration 022
**Context**: Need to generate occurrences and send reminders automatically.
**Decision**: Use pg_cron jobs on Supabase.
**Rationale**: Server-side scheduling works even when app is closed. More reliable than client-side timers.

## D009: Outlook-Compatible Email Templates
**Date**: Aug 4, 2026
**Context**: Emails need to work across all email clients including Outlook.
**Decision**: Use table-based HTML layout with MSO conditionals.
**Rationale**: Outlook doesn't support modern CSS. Table layout is the only reliable way.

## D010: Haptic Feedback on All Interactions
**Date**: Aug 4, 2026
**Context**: Mobile app needs tactile feedback for better UX.
**Decision**: Add expo-haptics on all button presses, selections, and success/error states.
**Rationale**: Industry standard for mobile apps. Different feedback types for different actions.

## D011: Single Source of Truth Helpers (Canonical Engine)
**Date**: Aug 5, 2026
**Context**: Engine and preview drifted apart across migrations 029-038; 044 left a 7-arg overload making two versions of `_compute_bill_due_date` live. Inline math in the engine was a third copy.
**Decision**: Extract ALL recurrence math into `_compute_next_cycle_start` + `_compute_bill_due_date` (5-arg) and have the engine, preview RPC, and triggers call only those helpers. Drop the 7-arg overload.
**Rationale**: One place for the logic to live — drift between "what the UI shows" and "what the engine writes" becomes impossible.

## D012: ROW_COUNT Over EXISTS for Insert Detection
**Date**: Aug 5, 2026
**Context**: After `INSERT ... ON CONFLICT DO NOTHING`, an `IF EXISTS` check on the cycle matched the row the statement just inserted, so the loop advanced forever (5000-row safety valve, dates ran to 2437/2443). Hit twice — once per function copy.
**Decision**: Use `GET DIAGNOSTICS v_inserted = ROW_COUNT` — 0 means the conflict clause swallowed the insert (cycle already existed → step forward), 1 means a fresh occurrence was created → RETURN.
**Rationale**: The only unambiguous way to tell "inserted" from "already existed" after ON CONFLICT DO NOTHING.

## D013: MODE 2 Full Rebuild on Edits
**Date**: Aug 5, 2026
**Context**: Editing recurrence fields or deleting a transaction left stale rows that incremental generation would skip past, producing wrong chains.
**Decision**: Split the engine into MODE 1 (incremental, idempotent — triggers on insert, mark-paid, cron) and MODE 2 (soft-delete all non-terminal rows, cancel pending reminders, rebuild purely from the definition — trigger on recurrence edits, delete transaction).
**Rationale**: Rebuild-from-definition is self-healing: garbage from old engines is wiped on the next edit/repair (052). Paid/archived rows remain immutable history.

## D014: Regression Suite as Deploy Gate
**Date**: Aug 5, 2026
**Context**: Every engine fix introduced new regressions (035→034, 044 NULLs, loop bugs).
**Decision**: Migration 053 carries a SQL assert suite (A1-A9 helper math, B1-B4 engine behavior incl. idempotency and rebuild). `db push` fails if any invariant breaks.
**Rationale**: A broken engine must never reach production silently; the suite is the deploy gate.

## D015: next_due_date as One-Shot Chain Override
**Date**: Aug 5, 2026
**Context**: Bills created with a past anchor ("last payment 1 Feb") only materialize the next future occurrence (11 Oct), but users think in terms of "next payment date" and want to explicitly pick ANY chain date — past ones included — as the next due date. Picking a past date must make the bill genuinely overdue/today.
**Decision**: Migration 054 adds `bills.next_due_date` (nullable). NULL = auto (first future cycle only). SET = the chain materializes from that cycle onward (past ones as 'overdue', built in ONE call — chain-building, not one row per cron run). The skip branch covers cycles before next_due_date even when they are FUTURE (a future pick skips the nearer ones, and the MODE 2 revive path must never resurrect them). Paying the selected cycle CONSUMES the override (cleared — one-shot instruction, chain resumes natural cadence).
**Rationale**: A persistent column the user explicitly manages beats "overdue catch-up" heuristics: the engine only creates overdue rows the user actually asked for, the dashboard/hero then surface them naturally, and staleness self-heals (paid rows are skipped via ON CONFLICT).

## D016: Per-Control Tap Guards Over Global Throttling
**Date**: Aug 5, 2026
**Context**: Impatient double-taps caused real damage: two same-frame taps on "Save bill" created two bills (the `loading` disable only applied after re-render), and RecurrencePreview's tap-again-to-clear toggle wiped a just-made selection. A global throttle would have hurt UX by eating deliberate rapid re-selection.
**Decision**: `useTapGuard(intervalMs)` (hooks/useTapGuard.ts) — a ref-based timestamp check per component instance, returning `boolean`. Guards sit inside each control (250–400 ms); a shared ref is never used across different controls. Guard runs BEFORE haptics. It supplements, never replaces, `loading`/`disabled`.
**Rationale**: Per-control isolation means switching between different categories/options is never throttled; only repeats of the same control are. Ref-based (not state) means zero re-renders. 250–400 ms is far below any deliberate second tap, so nothing intentional is ever swallowed.

## D017: Native Modules Off the Cold-Start Path
**Date**: Aug 5, 2026
**Context**: Root layout statically imported `lib/notifications.ts`, so the expo-notifications native module initialized during cold start, and the splash stayed visible until `getSession()` resolved — perceived launch was gated on SecureStore + possibly network.
**Decision**: (1) Lazy-import notifications in a `useEffect` (with mounted-flag cleanup). (2) Hide the splash on the first painted frame — the LoadingScreen behind it uses the identical `#080810` background, so the handoff is invisible — plus `SplashScreen.setOptions({ duration: 200, fade: true })`. (3) Theme hydrate and session restore run concurrently.
**Rationale**: Perceived launch speed is a UX feature. The splash must never block on work the user cannot perceive; the LoadingScreen continues to gate the auth redirect as before. Cost: none — notifications listeners are only needed after first paint anyway.
