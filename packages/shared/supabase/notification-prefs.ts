import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillNotificationPreference } from "../types";

export interface NotificationPrefsApi {
  /** Fetch the current user's preference row for a bill (null if none). */
  fetchBillPreference(
    billId: string,
    userId: string
  ): Promise<BillNotificationPreference | null>;
  /** Toggle push/email for the current user's bill. Only admin/super_admin can
   *  write — RLS enforces the member-block, the client just surfaces errors. */
  setBillPreference(
    billId: string,
    userId: string,
    patch: Partial<Pick<BillNotificationPreference, "push_enabled" | "email_enabled">>
  ): Promise<BillNotificationPreference>;
}

export function createNotificationPrefsApi(supabase: SupabaseClient): NotificationPrefsApi {
  return {
    async fetchBillPreference(billId, userId) {
      const { data, error } = await supabase
        .from("bill_notification_preferences")
        .select("*")
        .eq("bill_id", billId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return (data as BillNotificationPreference | null) ?? null;
    },

    async setBillPreference(billId, userId, patch) {
      const { data, error } = await supabase
        .from("bill_notification_preferences")
        .upsert(
          { bill_id: billId, user_id: userId, ...patch },
          { onConflict: "bill_id,user_id" }
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as BillNotificationPreference;
    },
  };
}