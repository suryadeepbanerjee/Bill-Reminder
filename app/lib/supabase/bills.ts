import { supabase } from "./client";
import { guardAsync } from "../action-guard";
import type { Bill, CreateBillInput, UpdateBillInput } from "./types";

const BILL_SELECT = `
  *,
  categories (
    id, name, icon, color, preset_key
  )
`;

export async function fetchBills(householdId: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select(BILL_SELECT)
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}

export async function fetchBillById(id: string): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .select(BILL_SELECT)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Bill;
}

export async function createBill(input: CreateBillInput): Promise<Bill> {
  return guardAsync(`mut:create-bill:${JSON.stringify(input)}`, async () => {
    const { data, error } = await supabase
      .from("bills")
      .insert(input)
      .select(BILL_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return data as Bill;
  }) as Promise<Bill>;
}

export async function updateBill(id: string, input: UpdateBillInput): Promise<Bill> {
  return guardAsync(`mut:update-bill:${id}:${JSON.stringify(input)}`, async () => {
    const { data, error } = await supabase
      .from("bills")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(BILL_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return data as Bill;
  }) as Promise<Bill>;
}

export async function deleteBill(id: string): Promise<void> {
  // Soft delete — sets is_active = false, preserves history
  await guardAsync(`mut:delete-bill:${id}`, async () => {
    const { error } = await supabase
      .from("bills")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(error.message);
  });
}
