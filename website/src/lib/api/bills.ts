import { supabase } from "../supabase";
import type { Bill, CreateBillInput, UpdateBillInput } from "../types";

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
  const { data, error } = await supabase
    .from("bills")
    .insert(input)
    .select(BILL_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as Bill;
}

export async function updateBill(id: string, input: UpdateBillInput): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(BILL_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase
    .from("bills")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}