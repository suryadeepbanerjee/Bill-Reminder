import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "./supabase/client";
import { fetchSyncData } from "./supabase/reminders";
import { savePushToken } from "./supabase/profile";

// ── Configuration ─────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Channels (Android) ────────────────────────────────────────────────────────

export async function setupNotificationChannels() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Bill Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D1A920", // accent color (gold)
    });
  }
}

// ── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === "granted";
}

// ── Push Token Registration ───────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
    });
    const expoPushToken = tokenData.data;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await savePushToken(session.user.id, expoPushToken, Platform.OS);
    }

    return expoPushToken;
  } catch (error: any) {
    if (error?.message?.includes("projectId")) {
      console.warn("Push notifications skipped: no EXPO_PUBLIC_EAS_PROJECT_ID set. Email reminders still work.");
      return null;
    }
    console.error("Failed to register for push notifications:", error);
    return null;
  }
}

// ── Scheduling ────────────────────────────────────────────────────────────────

export interface ReminderPayload {
  billId: string;
  occurrenceId: string;
  ruleId: string;
  title: string;
  body: string;
  triggerDate: Date;
}

export async function scheduleReminder({
  billId,
  occurrenceId,
  ruleId,
  title,
  body,
  triggerDate,
}: ReminderPayload): Promise<string | null> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  // Do not schedule in the past
  if (triggerDate.getTime() <= Date.now()) return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { billId, occurrenceId, ruleId },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: "reminders",
      },
    });
    return identifier;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

// ── Cancellation ──────────────────────────────────────────────────────────────

export async function cancelReminder(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error("Error canceling notification:", error);
  }
}

export async function cancelAllReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
}

// ── Synchronization ─────────────────────────────────────────────────────────────

export async function syncLocalReminders() {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", session.user.id)
      .single();
      
    if (!member) return;
    const householdId = member.household_id;

    const { occurrences, rules } = await fetchSyncData(householdId);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const desired = new Map<string, ReminderPayload>();

    for (const occurrence of occurrences) {
      const billRules = rules.filter(r => r.bill_id === occurrence.bill_id);
      for (const rule of billRules) {
        if (rule.channel === "email") continue;

        const anchorDateStr =
          rule.anchor === "generation" ? occurrence.generation_date :
          rule.anchor === "expected_payment" ? occurrence.expected_payment_date :
          occurrence.due_date;

        if (!anchorDateStr) continue;

        const triggerDate = new Date(anchorDateStr);
        triggerDate.setHours(9, 0, 0, 0); // Default to 9:00 AM local time
        triggerDate.setDate(triggerDate.getDate() + rule.offset_days);

        if (triggerDate.getTime() > Date.now()) {
          const uniqueId = `${occurrence.id}_${rule.id}`;
          
          const anchorLabel = rule.anchor === "expected_payment" ? "expected payment" : rule.anchor === "generation" ? "generation" : "due date";
          let body = `Your ${anchorLabel} for ${occurrence.bills.title} is today.`;
          if (rule.offset_days < 0) body = `Your ${anchorLabel} for ${occurrence.bills.title} is in ${Math.abs(rule.offset_days)} days.`;
          if (rule.offset_days > 0) body = `Your ${anchorLabel} for ${occurrence.bills.title} was ${rule.offset_days} days ago.`;

          desired.set(uniqueId, {
            billId: occurrence.bill_id,
            occurrenceId: occurrence.id,
            ruleId: rule.id,
            title: `Bill Reminder: ${occurrence.bills.title}`,
            body,
            triggerDate,
          });
        }
      }
    }

    const toCancel: string[] = [];
    const existingIds = new Set<string>();

    for (const req of scheduled) {
      const data = req.content.data as any;
      const occurrenceId = data?.occurrenceId;
      const ruleId = data?.ruleId;

      if (occurrenceId && ruleId) {
        const uniqueId = `${occurrenceId}_${ruleId}`;
        if (!desired.has(uniqueId)) {
          toCancel.push(req.identifier);
        } else {
          existingIds.add(uniqueId);
        }
      } else {
        toCancel.push(req.identifier);
      }
    }

    // Cancel obsolete
    for (const identifier of toCancel) {
      await cancelReminder(identifier);
    }

    // Schedule missing
    for (const [uniqueId, payload] of desired.entries()) {
      if (!existingIds.has(uniqueId)) {
        await scheduleReminder(payload);
      }
    }
  } catch (error) {
    console.error("Error synchronizing local reminders:", error);
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────────

export function setupNotificationListeners() {
  setupNotificationChannels();

  // Defer push registration until navigation is ready
  setTimeout(() => {
    registerForPushNotifications();
  }, 2000);

  // Handle tap on notification — defer to avoid navigation context errors
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.billId) {
      setTimeout(() => {
        router.push(`/bill/${data.billId}`);
      }, 500);
    }
  });

  return () => {
    responseSubscription.remove();
  };
}
