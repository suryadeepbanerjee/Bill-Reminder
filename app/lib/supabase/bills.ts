import { supabase } from "./client";
import { guardAsync } from "@shared/utils/action-guard";
import { createBillsApi } from "@shared/supabase/bills";
import type { Bill, CreateBillInput, UpdateBillInput } from "@shared/types";

const api = createBillsApi(supabase);

export const fetchBills = api.fetchBills;
export const fetchBillById = api.fetchBillById;

export function createBill(input: CreateBillInput): Promise<Bill> {
  return guardAsync(`mut:create-bill:${JSON.stringify(input)}`, () =>
    api.createBill(input)
  ) as Promise<Bill>;
}

export function updateBill(id: string, input: UpdateBillInput): Promise<Bill> {
  return guardAsync(`mut:update-bill:${id}:${JSON.stringify(input)}`, () =>
    api.updateBill(id, input)
  ) as Promise<Bill>;
}

export function deleteBill(id: string): Promise<void> {
  return guardAsync(`mut:delete-bill:${id}`, () =>
    api.deleteBill(id)
  ) as Promise<void>;
}
