import { supabase } from "../supabase";
import { createBillsApi } from "@shared/supabase/bills";

const api = createBillsApi(supabase);

export const fetchBills = api.fetchBills;
export const fetchBillById = api.fetchBillById;
export const createBill = api.createBill;
export const updateBill = api.updateBill;
export const deleteBill = api.deleteBill;
