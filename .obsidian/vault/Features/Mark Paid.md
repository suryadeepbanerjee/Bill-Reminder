# Mark Paid

## RPC (migration 046:8)
```sql
CREATE OR REPLACE FUNCTION public.mark_occurrence_paid(
  p_occurrence_id uuid, p_paid_at timestamptz, p_paid_amount numeric,
  p_payment_notes text, p_receipt_path text, p_shift_anchor boolean
) RETURNS void
-- Sets state='paid', paid_at, paid_amount, payment_notes, receipt_path
-- If p_shift_anchor=true: UPDATE bills SET anchor_date = p_paid_at::date WHERE id = bill_id
-- Then calls generate_next_occurrence
```

## Client (occurrences.ts:103)
```typescript
export async function markOccurrencePaid(input: MarkPaidInput): Promise<void> {
  const { error: occError } = await supabase.rpc("mark_occurrence_paid", {
    p_occurrence_id: input.occurrence_id,
    p_paid_at: input.paid_at,
    p_paid_amount: input.paid_amount || 0,
    p_payment_notes: input.payment_notes ?? null,
    p_receipt_path: input.receipt_path ?? null,
    p_shift_anchor: input.shift_anchor_to_payment ?? false
  });
  if (occError) throw new Error(occError.message);
  // Cancel pending reminders
  await supabase.from("scheduled_reminders").update({ status: "cancelled" })
    .eq("occurrence_id", input.occurrence_id).eq("status", "pending");
}
```

## Optimistic Update (useOccurrences.ts:47)
```typescript
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey: ["dashboard"] });
  const snapshot = queryClient.getQueryData(["dashboard"]);
  queryClient.setQueryData(["dashboard"], (old) => {
    // Update occurrence state to 'paid' in-place across all sections
    // Add to recentlyPaid
    return { ...old, today, overdue, upcoming, recentlyPaid };
  });
  return { snapshot };
},
onError: (_err, _input, context) => {
  if (context?.snapshot) queryClient.setQueryData(["dashboard"], context.snapshot);
},
```

## Modal (MarkPaidModal.tsx)
```typescript
interface MarkPaidTarget {
  occurrence: BillOccurrence;
  bill: Bill;
}
// Form: amount (pre-filled), date (defaults to today), notes
// For prepaid/wallet: shift_anchor_to_payment toggle
// Calls useMarkPaid → markOccurrencePaid
```

## Types (types.ts:155)
```typescript
export interface MarkPaidInput {
  occurrence_id: string;
  paid_amount: number;
  paid_at: string;
  payment_notes?: string | null;
  receipt_path?: string | null;
  shift_anchor_to_payment?: boolean;
}
```
