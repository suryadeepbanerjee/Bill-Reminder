# Components

> Everything in `app/components/` — a compact index. Full props + behavior:
> [[Architecture/UI Components]].

## UI primitives (`app/components/ui/`)

| Component | File | Notes |
|-----------|------|-------|
| `Button` | Button.tsx | variants primary/secondary/ghost/destructive/accent; `loading` auto-disables; haptics |
| `IconButton` | IconButton.tsx | ghost/filled/danger, sizes sm 32 / md 40 / lg 48 |
| `Modal` | Modal.tsx | bottom-sheet or center; **adds handle bar + bottom inset → inner content must use `max-h-[75vh]`, not 85vh** (edit-sheet fix) |
| `TextInput` | TextInput.tsx | label, error, hint, maxCharacters |
| `NumericInput` | NumericInput.tsx | decimal-pad amount input with ₹ leading icon |
| `AlertBadge` | AlertBadge.tsx | error/success/warning/info, role="alert" |
| `Divider` | Divider.tsx | hairline |
| `Surface` / `ListItem` / `SectionHeader` / `Chip` / `Switch` | — | settings + filters |
| `SearchField` | — | bills list search |
| `FAB` | FAB.tsx | accent shadow + scale, bottom-right |
| `LoadingSkeleton` | — | dashboard + list variants |
| `EmptyState` | — | bills / search variants |
| `ErrorView` | — | retry CTA |
| `Toast` | — | auto-dismiss bar |
| `DateAnchorPicker` | DateAnchorPicker.tsx | MonthPicker + DayPicker + YearPicker; `order="MDY"|"DMY"`; `yearMin/yearMax` props; `buildAnchorDate`/`formatDateDisplay`/`formatDateShort` |
| `MonthPicker` | MonthPicker.tsx | 3×4 month grid |
| `DayPicker` | DayPicker.tsx | **44px rounded squares** (`w-11 h-11 rounded-input`), percentage grid (flexBasis 100/7%) → always 7 columns/row, `gap: 8`, tabular-nums `numberOfLines={1}`; max day auto-clamps by month/year |
| `YearPicker` | YearPicker.tsx | chips, default 2020–2027; min/max overridable |

## Bill components (`app/components/bills/`)

| Component | Notes |
|-----------|-------|
| `BillCard` (memo) | category badge, title, provider, state chip, amount, quick "Mark paid"; **stable callbacks required** from list parents (see [[Architecture/Startup & Performance]]) |
| `BillStateChip` | 7 states: upcoming/generated/expected_payment/due_today/overdue/paid/archived |
| `CategoryPill` / `CategoryIconBadge` | `CategoryIconBadge` gained `selected?: boolean` → accent fill + inverted icon (white light / dark `#121212`); badge is otherwise neutral (`bg-neutral-100 dark:bg-neutral-800`) |
| `MarkPaidModal` | amount, date, notes, anchor shift toggle |
| `DeleteTransactionModal` | anchor adjust options per behavior type, date validation |
| `RecurrencePreview` | next-occurrence list via `preview_bill_occurrences` RPC; **tappable rows** (select next_due_date, tap-again clears, "Next" badge, overdue hint); rows guarded by `SelectablePreviewRow` (250 ms) |

## Related
- [[Architecture/UI Components]] — full prop-by-prop reference
- [[Hooks/All]]
- [[Lib/All]]
