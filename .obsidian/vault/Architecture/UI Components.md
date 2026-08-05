# UI Component Library

## Shared Components (app/components/ui/)

### Modal
- Animated bottom sheet or center modal
- Reanimated slide-up animation
- Keyboard-aware (adjusts for keyboard height)
- **`max-h-[75vh]` for inner content — NOT 85vh** (the Modal adds a handle bar + bottom inset, which pushed action bars off-screen at 85vh — edit-sheet fix)
- Backdrop press to dismiss
- Safe area inset handling

### Button
- Variants: `primary`, `secondary`, `ghost`, `destructive`, `accent`
- Sizes: `sm`, `md`, `lg`
- Loading state with ActivityIndicator
- Haptic feedback on press
- Full-width option

### IconButton
- Variants: `default`, `ghost`, `filled`, `danger`
- Sizes: `sm` (32px), `md` (40px), `lg` (48px)
- Accepts ReactNode for icon

### AlertBadge
- Variants: `error`, `success`, `warning`, `info`
- Dot indicator + message text
- Accessible (role="alert")

### DateAnchorPicker
- Composed of MonthPicker, DayPicker, YearPicker
- `buildAnchorDate(month, day, year)` → `YYYY-MM-DD` string
- `formatDateDisplay(dateStr)` → "1 Jan 2026" · `formatDateShort(dateStr)` → "1 Jan"
- Auto-clamps day when month changes
- `order="MDY" | "DMY"`, `yearMin`/`yearMax` props (due-date pickers pass `DUE_DATE_YEAR_MIN/MAX` = 2026–2035)

### MonthPicker
- Grid of 12 months (3×4)
- Circle buttons
- Haptic selection feedback

### DayPicker
- Grid of days up to `maxDay` (default 31, auto-clamped by month/year)
- **Percentage-based grid** (`flexBasis: 100/7%`) — always exactly 7 columns per row, no fixed-px overflow on narrow phones
- Cells are **44px rounded squares** (`w-11 h-11 rounded-input`) with tabular-nums day text (`numberOfLines={1}`) — NOT circles
- `gap: 8`, default label "Day"
- Exports `getMaxDayForMonth(month, year?)` — returns valid day count (handles leap years)

### YearPicker
- Default range 2020–2027; `min`/`max` overridable (due dates use 2026–2035)
- Chip layout (not circles)

### FAB
- Floating action button
- Positioned bottom-right
- Shadow + scale animation

### SectionHeader
- Title + optional action button

### LoadingSkeleton
- Animated placeholder for loading states

### EmptyState
- Icon + title + subtitle
- Used when lists are empty

### Toast
- Animated notification bar
- Auto-dismiss

## Bill Components (app/components/bills/)

### BillCard
- Displays bill info with category icon, title, provider
- Shows state chip and amount
- "Mark paid" quick action for due/overdue bills
- Memoized for performance
- Handles null categories gracefully

### BillStateChip
- 7 state variants with unique colors and icons
- States: upcoming, generated, expected_payment, due_today, overdue, paid, archived
- Custom label override (e.g., "3 days overdue")

### CategoryPill / CategoryIconBadge
- `CategoryPill`: neutral chip (`bg-neutral-100 dark:bg-neutral-800`) — icon + label
- `CategoryIconBadge`: circle badge for cards/lists
- **`selected?: boolean` prop (Aug 5)**: accent fill + inverted icon (white in light, `#121212` in dark) — used by add-bill's category grid; plain neutral badge otherwise. Category colors in the DB are all grays — do NOT use them as fills.

### RecurrencePreview
- Next-occurrence list via `preview_bill_occurrences` RPC
- **Tappable rows** (when `onChange` provided): select next-due date, tap selected row again to clear, "Next" badge on current pick, past picks show "Overdue — bill will show as past due"
- Rows are `SelectablePreviewRow` (250 ms tap guard — protects the toggle)
- Loading and error states

### MarkPaidModal
- Amount input (pre-filled with expected)
- Date picker (defaults to today)
- Optional payment notes
- Shift anchor toggle (for prepaid/wallet)
- Haptic success feedback

### DeleteTransactionModal
- Shows bill name + payment date
- Warning about removal
- For prepaid/wallet: anchor adjustment options (keep/revert/custom)
- For fixed-date: explanatory text
- DateAnchorPicker for custom dates
- ScrollView wrapper
- Date validation (>= created_at, <= today)
