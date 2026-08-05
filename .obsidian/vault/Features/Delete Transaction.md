# Delete Transaction

## Full Pipeline

### 1. UI Trigger (bill/[id].tsx:849)
```typescript
setDeleteTransactionTarget({
  occurrence: o,
  bill: bill!,
  isOldest: idx === arr.length - 1,
  hasOlder: idx < arr.length - 1,
  previousCycleStart: idx < arr.length - 1 ? arr[idx + 1].cycle_start : null,
});
```

### 2. Modal (DeleteTransactionModal.tsx:1)
```typescript
interface DeleteTransactionTarget {
  occurrence: BillOccurrence;
  bill: Bill;
  isOldest: boolean;
  hasOlder: boolean;
  previousCycleStart?: string | null;
}
// Shows: bill name + payment date, warning, anchor options for prepaid/wallet
// Fixed-date: "Only this payment record will be removed; the billing schedule stays the same."
// Prepaid/wallet: Radio group with actual dates (keep/revert/custom)
```

### 3. Client (occurrences.ts:133)
```typescript
export async function deleteOccurrenceTransaction(input: DeleteTransactionInput): Promise<void> {
  const { error } = await supabase.rpc("delete_occurrence_transaction", {
    p_occurrence_id: input.occurrence_id,
    p_anchor_action: input.anchor_action,
    p_custom_anchor: input.custom_anchor ?? null,
  });
  if (error) throw new Error(error.message);
  // Cancel pending reminders
  await supabase.from("scheduled_reminders").update({ status: "cancelled" })
    .eq("occurrence_id", input.occurrence_id).eq("status", "pending");
}
```

### 4. Hook (useOccurrences.ts:108)
```typescript
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteTransactionInput) => deleteOccurrenceTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}
```

### 5. RPC (migration 048:4)
```sql
-- Soft-delete target
UPDATE bill_occurrences SET deleted_at = now() WHERE id = p_occurrence_id;
-- Cancel reminders
UPDATE scheduled_reminders SET status = 'cancelled' WHERE occurrence_id = p_occurrence_id AND status = 'pending';
-- Soft-delete future unpaid
UPDATE bill_occurrences SET deleted_at = now()
WHERE bill_id = v_bill.id AND state IN ('upcoming','generated','expected_payment','due_today','overdue')
  AND cycle_start > v_occ.cycle_start AND deleted_at IS NULL;
-- Handle anchor (keep/revert/custom)
-- Revert: prev paid's paid_at, or deleted's paid_at, or created_at
-- Custom: validate >= created_at, <= today
-- Regenerate
PERFORM generate_next_occurrence(v_bill.id);
```

### 6. Engine Fix (migration 049:9)
```sql
-- Before: SELECT max(cycle_start) FROM bill_occurrences WHERE bill_id = p_bill_id;
-- After:  SELECT max(cycle_start) FROM bill_occurrences WHERE bill_id = p_bill_id AND deleted_at IS NULL;
-- This ensures the engine falls back to anchor_date when all occurrences are deleted
```
