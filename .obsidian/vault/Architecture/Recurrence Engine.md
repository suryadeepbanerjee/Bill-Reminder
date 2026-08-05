# Recurrence Engine

## Architecture (canonical since 051)

```
  bills (definition)
    │  INSERT → tr_generate_initial_occurrence (bills_after_insert_generate)
    │  UPDATE (recurrence fields) → tr_generate_on_bill_update (bills_after_update_generate)
    ▼
  generate_next_occurrence(uuid)            -- MODE 1: incremental, idempotent
  generate_next_occurrence(uuid, boolean)   -- MODE 2: full rebuild from definition
    │  uses helpers (single source of truth, shared with preview RPC)
    ▼
  _compute_next_cycle_start(behavior, repeat_kind, interval, anchor, created, latest)
  _compute_bill_due_date(cycle, behavior, repeat_kind, due_day_offset, anchor)
    ▼
  bill_occurrences (one row per cycle, unique (bill_id, cycle_start))
```

## Helper Rules (shared by engine + preview → UI parity)

| repeat_kind × behavior | cycle stepping | due date |
|---|---|---|
| monthly × prepaid/wallet | +1 month, snap to anchor day | = cycle_start |
| monthly × fixed | +1 month, snap to anchor day | anchor day (clamped) + due_day_offset |
| yearly × prepaid/wallet | +1 year, snap to anchor month+day | = cycle_start |
| yearly × fixed | +1 year, snap to anchor month+day | anchor month+day (clamped), **never created_at month** |
| every_x_days/weeks | pure interval arithmetic, **no anchor-day snap** | = cycle_start |
| every_x_months | interval months, snap to anchor day | = cycle_start |
| none × fixed | = anchor (one cycle only) | = anchor |
| none × prepaid | = anchor (one cycle only) | = anchor |

- `anchor_date` is the ONLY reference point; `anchor_month`/`anchor_day`/`anchor_year` are form-only.
- Fixed-due-date bills: due_day_offset 0 = last day of month, N = Nth day (clamped).
- Prepaid/wallet: gen date = due − 3 (prepaid) / due − 1 (wallet), expected = due; fixed: gen = due + generation_day_offset (default −7), expected = due + expected_payment_day_offset (default −3).

## MODE 1 — `generate_next_occurrence(uuid)`
Entry points: insert/update triggers, mark-paid continuation, cron (daily 2AM).
1. `SELECT * INTO v_bill ... FOR UPDATE` (locks the bill row).
2. **Idempotency guard**: if an open occurrence (deleted_at IS NULL, state NOT IN paid/archived, due ≥ today) already exists → RETURN (no work).
3. `v_latest := max(cycle_start) WHERE deleted_at IS NULL`.
4. LOOP (≤5000):
   - compute next cycle via `_compute_next_cycle_start`; NULL → RETURN.
   - compute due/gen/expected via `_compute_bill_due_date`.
   - **Skip branch (054)**: skip cycles that must NOT materialize —
     `(next_due_date IS NOT NULL AND cycle < next_due_date)` — covers past AND future cycles, so a future pick skips the nearer ones and the revive path can never resurrect them — OR `(next_due_date IS NULL AND due < today AND repeat_kind <> 'none')` (default catch-up). **'none' bills always materialize even as 'overdue'.**
   - revive: `UPDATE ... SET deleted_at = NULL ... WHERE cycle_start = v_next AND deleted_at IS NOT NULL; IF FOUND THEN RETURN;`
   - insert: `INSERT ... ON CONFLICT (bill_id, cycle_start) DO NOTHING;`
   - **`GET DIAGNOSTICS v_inserted = ROW_COUNT; IF v_inserted = 0 THEN advance; CONTINUE; END IF;`**
   - **Chain-building (054)**: if the row we just materialized is still in the past (`due < today AND repeat_kind <> 'none'`), advance and CONTINUE — one call produces the whole visible chain for a past next-due selection, not one row per cron run.
   - The ROW_COUNT check is the ONLY reliable way to detect "cycle already existed" — an `IF EXISTS` check after the insert matches the row just inserted and loops forever.

## MODE 2 — `generate_next_occurrence(uuid, TRUE)`
Entry points: bill edits on recurrence fields (trigger), anchor changes, `delete_occurrence_transaction` (chain rebuild).
1. Same guard + `SELECT ... FOR UPDATE`.
2. Soft-delete every non-terminal occurrence (`deleted_at = now()`); **paid/archived are immutable history**.
3. Cancel all pending reminders for the bill.
4. Rebuild purely from the bill definition: `v_latest := NULL`, then the same LOOP as MODE 1.
   - Rebuild is self-healing: any garbage rows from old engines are soft-deleted in step 2, so re-running 052-style repairs is idempotent.

## Trigger Chain
```
Bill INSERT → tr_generate_initial_occurrence → MODE 1
Bill UPDATE → tr_generate_on_bill_update → MODE 2
  (fires only if behavior_type, repeat_kind, repeat_interval, due_day_offset,
   anchor_date, next_due_date, validity_days, check_interval_days,
   generation_day_offset, expected_payment_day_offset, amount_expected changed)
Occurrence UPDATE (state→paid) → mark_occurrence_paid RPC → MODE 1 / MODE 2
  (anchor-shift path updates bills.anchor_date → fires update trigger → MODE 2)
  (054: paying the cycle whose cycle_start = next_due_date CONSUMES the
   override — next_due_date is cleared so the chain resumes its natural
   cadence; the override is a one-shot instruction)
Delete transaction → delete_occurrence_transaction RPC → MODE 2
```

## next_due_date (054) — the "next due date" control
- `bills.next_due_date date NULL` — chain-start override. NULL = auto (first future cycle only). SET = the chain materializes FROM that cycle: past ones as 'overdue' (one call builds the whole visible chain), the first future one ends it.
- A FUTURE selection skips the nearer cycles (they are not owed — the skip branch covers cycles before next_due_date even when they are in the future).
- Paid rows are untouched (ON CONFLICT skips them) — a stale next_due_date self-heals as the chain passes it.
- Trigger fires on next_due_date edits (MODE 2 full rebuild); edits to anchor/schedule via the edit sheet clear a stale selection client-side.
- UI: RecurrencePreview rows are tappable in Add/Edit bill — "Next" badge defaults to the first future date; tapping a past date marks it as next due (bill shows overdue until paid); tapping again clears.

## Invariants (verified by 053 + 054 C1-C6)
1. Insert trigger creates exactly ONE open occurrence.
2. No bill ever has >1 open future occurrence (052 self-check + regression B3b).
3. Cron runs are no-ops when a chain exists (MODE 1 guard) — no duplicate rows ever.
4. Anchor edits rebuild the chain from the NEW anchor.
5. Engine and preview produce identical dates (same helpers).
6. `cycle_start` is unique per bill — duplicate = engine bug.
7. (054) A past next-due selection materializes overdue rows + exactly one future row in one call.
8. (054) A future next-due selection skips everything before it; clearing it collapses back to one future row.
9. (054) Paying the selected cycle consumes the override (next_due_date → NULL) — no stale gap.

## Historical Bugs (why the canonical rewrite exists)
| Migration | Bug |
|---|---|
| 029-038 | engine + preview were two hand-maintained copies → drifted (039 fixed) |
| 036 | skip-past + yearly snap used created_at month for fixed yearly (Domain renewal bug) |
| 039 | every_x_* re-snapped due date to anchor day, destroying interval math |
| 044 | prepaid one-time returned NULL (7-arg fallback) |
| 049 | engine was inline, 7-arg `_compute_bill_due_date` overload survived → two sources of truth |
| 051 (push 1) | `IF EXISTS` post-insert check matched own insert → infinite loop (years 2437/2443) |
| 051 (push 2) | same loop remained in MODE 2 (fix applied to MODE 1 only) → B4d failure |
| 054 (push 1) | C4b: revive path resurrected a soft-deleted cycle before a future next_due_date — skip branch must cover future cycles too |
| 054 (push 2) | C2a: test expected 3 rows for a past selection with no intermediate cycles — engine was right (2), fixture fixed |
| 054 (push 3) | C5: early-pay + stale override would skip a cycle — mark_occurrence_paid now consumes the override |
| fixed | ROW_COUNT detection in both modes; deployed with 052 repair + 053 regression suite |

## Helper Functions (still live, used by preview RPC)
```sql
_anchor_day(date)            -- 034: day-of-month of anchor
_days_in_month(date)         -- 036: clamped month length
_snap_to_anchor(...)         -- 030: month+day or day-only snap
_compute_next_cycle_start(...)   -- 051: canonical stepping (see table above)
_compute_bill_due_date(5-arg)    -- 051: canonical due date; 7-arg overload DROPPED
```

## Key Migrations
| # | What Changed |
|---|-------------|
| 018 | Initial engine + insert/update triggers |
| 029 | `_snap_to_anchor` for prepaid |
| 030 | AFTER UPDATE trigger |
| 034 | `_anchor_day`, prepaid first-occurrence uses anchor |
| 036 | `_days_in_month`, yearly snap, skip past |
| 039 | Unified due date (engine = preview helpers) |
| 043 | Don't skip past occurrences |
| 046 | mark_occurrence_paid RPC |
| 047/048 | deleted_at soft-delete + delete RPC with chain rebuild |
| 049 | deleted_at IS NULL filter, revert fallback |
| 050 | Ensure helpers exist |
| **051** | **Canonical engine: helpers as single source of truth, MODE 1 + MODE 2, ROW_COUNT idempotency, 'none' bills materialize as overdue, 7-arg dropped** |
| **052** | **Live repair via MODE 2 rebuild + orphan-reminder cancel + dup self-check** |
| **053** | **Full regression suite (A1-A9, B1-B4d) — deploy gate** |
| **054** | **`next_due_date` override: skip branch (past+future), chain-building, trigger on next_due_date, mark-paid consumption, C1-C6 regression** |
