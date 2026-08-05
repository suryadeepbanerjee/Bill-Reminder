# Key Patterns

## Haptics (Every Interaction)
```typescript
import * as Haptics from "expo-haptics";
// Button press: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
// Mark paid: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
// Selection: Haptics.selectionAsync()
// Success: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
// Error: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
// Warning (destructive button): Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
```

## Memo (Performance)
```typescript
// BillCard.tsx:35 — memoized; only effective if parents pass STABLE props.
export const BillCard = memo(function BillCard({ bill, occurrence, onPress, onMarkPaid }) { ... });
```
**Stable-props rule** (see [[Architecture/Startup & Performance]]):
- List `renderItem` must be `useCallback`-stable or every parent render re-renders all rows.
- Never inline `() => {}` / `() => router.push(...)` into a memoized child — hoist via `useCallback` (a `noop` singleton for no-ops).
- Dashboard sections are `memo`-wrapped with stable `openBill`/`goToBills` handlers.

## Tap Guard (Double-Tap Protection)
```typescript
// hooks/useTapGuard.ts:16 — per-control, ref-based, zero re-renders.
const guard = useTapGuard(300);       // 250–400 ms depending on control
const onPress = () => {
  if (!guard()) return;               // swallowed: no haptic, no action
  // …real work
};
```
Applied to: category grid, behavior options, repeat-kind rows, RecurrencePreview rows (250 ms), Next/Back/Close (300 ms), Save bill (400 ms — prevents duplicate bills). Spec: [[Architecture/Interaction Guarding]].

## Input Sanitization (Trim via Zod)
```typescript
// Trims live in the SCHEMA so every zodResolver form gets them for free:
title: z.string().trim().min(1, "Title is required").max(120, …),
email: z.string().trim().email("Please enter a valid email address"),
```
Validation runs against the trimmed value. Fields: `title`, `provider_name`, `payment_notes`, `email` ×3, `displayName`. Spec: [[Architecture/Input Sanitization & Error Safety]].

## Optimistic Updates (useMarkPaid)
```typescript
// useOccurrences.ts — onMutate snapshots dashboard, updates locally
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey: ["dashboard"] });
  const snapshot = queryClient.getQueryData(["dashboard"]);
  queryClient.setQueryData(["dashboard"], (old) => { /* update in-place */ });
  return { snapshot };
},
onError: (_err, _input, context) => {
  if (context?.snapshot) queryClient.setQueryData(["dashboard"], context.snapshot);
},
```

## Query Key Pattern
```typescript
["bills", householdId]           // useBills
["bill", billId]                 // useBill
["occurrences", billId]          // useBillOccurrences
["currentOccurrence", billId]    // useCurrentOccurrence
["dashboard", householdId]       // useDashboard
["reminderRules", billId]        // useReminderRules
["households", userId]           // useHousehold
```

## Cache Invalidation Pattern
```typescript
// After any mutation:
queryClient.invalidateQueries({ queryKey: ["bills"] });
queryClient.invalidateQueries({ queryKey: ["dashboard"] });
queryClient.invalidateQueries({ queryKey: ["occurrences", id] });
import("../lib/notifications").then(m => m.syncLocalReminders());
```

## Form Pattern (React Hook Form + Zod)
```typescript
const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
  mode: "onBlur",
});
```

## Supabase Client Pattern
```typescript
// client.ts — SecureStore adapter for session persistence
const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
export const supabase = createClient(url, key, {
  auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, flowType: "implicit" },
});
export const redirectUri = "bill-reminder://callback";
export const webRedirectUri = "https://billreminder.suryadeepbanerjee.in/auth/callback";
```

## RLS Pattern
```sql
-- All tables have RLS enabled
-- Users access data only via household_members join
-- SECURITY DEFINER functions bypass RLS for admin operations
-- Client calls use user's JWT (anon key + session)
-- Edge functions use service-role key for cross-user operations
```

## Error Handling Pattern
```typescript
// lib/errors.ts:61 — humanize() is the ONLY thing that may reach the user.
// SAFE_MESSAGES set (39) → pattern-match (network, OTP, session, rate-limit, …) → context fallback (9).
// Raw e.message leaks were removed in the Aug 5 pass (accept-invite, members ×5, settings).
import { humanize, friendlyError } from "../lib/errors";
setError(humanize(e, "unknown"));      // forms, modals
Alert.alert("Error", friendlyError(e)); // settings actions
```

## Date Pattern
```typescript
// DateAnchorPicker: month (1-12), day (1-31), year pickers
// Due-date pickers (one-time): DUE_DATE_YEAR_MIN/MAX from schemas/bill.ts (current → +9, i.e. 2026–2035)
// Last-payment pickers (every_x_*): YearPicker defaults 2020–2027 (full range)
// buildAnchorDate(month, day, year) → "YYYY-MM-DD" | null
// DB stores: anchor_date (DATE), due_date (DATE), paid_at (TIMESTAMPTZ)
// UI displays: formatDateDisplay("2026-08-04") → "4 Aug 2026"
```
