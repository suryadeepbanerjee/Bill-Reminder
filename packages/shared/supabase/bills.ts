import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bill, CreateBillInput, UpdateBillInput } from "../types";

const BILL_SELECT = `
  *,
  categories (
    id, name, icon, color, preset_key
  )
`;

export interface BillsApi {
  fetchBills(householdId: string): Promise<Bill[]>;
  fetchBillById(id: string): Promise<Bill>;
  createBill(input: CreateBillInput): Promise<Bill>;
  updateBill(id: string, input: UpdateBillInput): Promise<Bill>;
  deleteBill(id: string): Promise<void>;
}

/**
 * Client-bound bills data layer. Each platform binds its own Supabase client
 * (app: SecureStore-backed client, website: sessionStorage-backed client).
 * Platforms add their own double-submit guards around mutations.
 */
export function createBillsApi(supabase: SupabaseClient): BillsApi {
  return {
    async fetchBills(householdId: string): Promise<Bill[]> {
      const { data, error } = await supabase
        .from("bills")
        .select(BILL_SELECT)
        .eq("household_id", householdId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as Bill[];
    },

    async fetchBillById(id: string): Promise<Bill> {
      const { data, error } = await supabase
        .from("bills")
        .select(BILL_SELECT)
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);
      return data as Bill;
    },

    async createBill(input: CreateBillInput): Promise<Bill> {
      const { data, error } = await supabase
        .from("bills")
        .insert(input)
        .select(BILL_SELECT)
        .single();

      if (error) throw new Error(error.message);
      return data as Bill;
    },

    async updateBill(id: string, input: UpdateBillInput): Promise<Bill> {
      const { data, error } = await supabase
        .from("bills")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(BILL_SELECT)
        .single();

      if (error) throw new Error(error.message);
      return data as Bill;
    },

    async deleteBill(id: string): Promise<void> {
      // Soft delete — sets is_active = false, preserves history
      const { error } = await supabase
        .from("bills")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw new Error(error.message);
    },
  };
}
