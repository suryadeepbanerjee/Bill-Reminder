# Day 2 — UI Hardening Pass

**Date**: Aug 5, 2026 · **Scope**: UI-only — zero backend changes, zero screen redesigns

## 1. Cold-Start & Render Performance
- Root layout: `expo-notifications` moved off the cold-start path (lazy import); splash hides
  on first painted frame (LoadingScreen is pixel-compatible `#080810`) + 200 ms fade.
- Bills list: `renderItem` now `useCallback`-stable → `BillCard` memo actually works; rows no
  longer re-render on every search keystroke/refetch.
- Dashboard: sections memoized, handlers hoisted to stable `useCallback`s → rows re-render
  only on query data changes.
- Full spec: [[Architecture/Startup & Performance]]

## 2. Tap Guarding
- New `app/hooks/useTapGuard.ts` — per-control, ref-based double-tap guard (250–400 ms).
- Applied: category grid, behavior options, repeat-kind rows, RecurrencePreview rows
  (toggle-clear protection), Next/Back/Close, and **Save bill (400 ms — prevents duplicate
  bills from same-frame double-taps)**.
- Full spec: [[Architecture/Interaction Guarding]] · Decision: D016

## 3. Input Sanitization
- `.trim()` added in zod schemas: `title`, `provider_name`, `payment_notes` (bill.ts),
  `email` ×3, `displayName` (auth.ts). All RHF forms now submit trimmed values.
- Full spec: [[Architecture/Input Sanitization & Error Safety]]

## 4. Error Surfaces
- Raw `e.message` leaks fixed → `friendlyError()`: `accept-invite.tsx`, `members.tsx` (5×),
  `settings/index.tsx` (create household). Everything else already passed `humanize()`.

## 5. Visual Fixes
- **Category badge** (`CategoryPill.tsx`): `CategoryIconBadge` gained `selected` variant —
  accent fill with inverted icon; selected category cards in add-bill now show a
  checkmark-circle. Fixes washed-out white badge on gold/indigo tint in light theme.
- **Day picker** (`DayPicker.tsx`): 56 px oval chips → **72×72 perfect circles** — exact
  half-size radius (`36`), no `overflow:hidden` (Android clips radius to square), padding 12,
  gap 8, day text bumped to `text-label` with `numberOfLines={1}`. Identical shape for "1"
  and "11".
  > *Since revised:* DayPicker is now **44px rounded squares on a percentage-width grid**
  > (see [[Architecture/UI Components]]) — this note records Day 2's historical change.

## Verifications
- `npx tsc --noEmit` — clean after every change.
- No emulator available — no on-device run; Pending #1.
- DB untouched (no migrations; 054 already deployed + verified earlier today).

## Related
- [[Home]] · [[Pending]] · [[Architecture/Key Patterns]]
