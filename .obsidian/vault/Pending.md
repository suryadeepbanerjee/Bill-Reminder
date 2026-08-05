# Pending

> Open work, in priority order. Updated Aug 5, 2026.

## 1. Verify splash-timing change on a real device
The cold-start pass ([[Architecture/Startup & Performance]]) now hides the splash on the
first painted frame instead of after `getSession()`. Typecheck-clean and logic-sound
(LoadingScreen bg is identical `#080810`), but not yet verified on Android/iOS hardware.

## 1b. Verify duplicate-notification fix on device
Client-side dedupe shipped (Day 3 §5): `syncLocalReminders` now skips local scheduling
while a `push_tokens` row exists (server owns push) and cancels any local leftovers.
Device test: token registered → exactly **one** push per rule, zero local; token removed
(dev build) → single local fallback. **Known server caveat**: the materializer iterates
all open occurrences per bill — a bill with an unresolved overdue row + next cycle can
still double-push from the server. If duplicates persist after this fix, dedupe the
server loop (materializer/push-sender, edge-function task) — see Day 3 §5.

## 2. Push notifications on Android (pipeline unverified)
Firebase is configured in app.json but the end-to-end pipeline (token → FCM → notification)
has never been verified on a physical Android device. `registerForPushNotifications()` warns
and skips gracefully when `EXPO_PUBLIC_EAS_PROJECT_ID` is unset — email reminders still work.

## 3. Test delete flow end-to-end
`delete_occurrence_transaction` (048) + MODE 2 rebuild (051) need a full end-to-end test:
delete mid-chain → verify chain rebuilt from definition → paid rows stay immutable.

## 4. Swipe between tabs (low priority)
Gesture conflicts with expo-router; tab bar taps work fine. Deferred.

## 5. Year-horizon cleanup (low priority)
`YearPicker.tsx` hardcodes default MIN 2020 / MAX 2027. Due-date pickers correctly pass
`DUE_DATE_YEAR_MIN/MAX` (2026–2035) from `schemas/bill.ts`, but the hardcoded constants
should eventually read from the schema too — single source of truth.

## Related
- [[Home]]
- [[Daily Notes/Day 2 - UI Hardening Pass]]
