import { supabase } from "./client";
import { guardAsync } from "@shared/utils/action-guard";
import { createNotificationPrefsApi } from "@shared/supabase/notification-prefs";
import type { BillNotificationPreference } from "@shared/types";

const api = createNotificationPrefsApi(supabase);

export function fetchBillPreference(
  billId: string,
  userId: string
): Promise<BillNotificationPreference | null> {
  return api.fetchBillPreference(billId, userId);
}

export function setBillPreference(
  billId: string,
  userId: string,
  patch: Partial<Pick<BillNotificationPreference, "push_enabled" | "email_enabled">>
): Promise<BillNotificationPreference> {
  return guardAsync(`mut:bill-pref:${billId}:${userId}:${JSON.stringify(patch)}`, () =>
    api.setBillPreference(billId, userId, patch)
  ) as Promise<BillNotificationPreference>;
}