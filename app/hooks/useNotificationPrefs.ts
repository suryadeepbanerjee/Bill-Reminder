import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBillPreference,
  setBillPreference,
} from "../lib/supabase/notification-prefs";
import type { BillNotificationPreference } from "@shared/types";

/** The current user's push/email preference for one bill. */
export function useBillNotificationPreference(billId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["billNotificationPreference", billId, userId],
    queryFn:  () => fetchBillPreference(billId!, userId!),
    enabled:  Boolean(billId && userId),
  });
}

export function useSetBillNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      billId,
      userId,
      patch,
    }: {
      billId: string;
      userId: string;
      patch: Partial<Pick<BillNotificationPreference, "push_enabled" | "email_enabled">>;
    }) => setBillPreference(billId, userId, patch),
    onSuccess: (_data, { billId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ["billNotificationPreference", billId, userId] });
      import("../lib/notifications").then(m => m.syncLocalReminders());
    },
  });
}