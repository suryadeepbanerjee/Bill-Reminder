import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Tracks the device notification permission state and re-checks it whenever
 * the app returns to the foreground (e.g. after the user leaves to enable
 * notifications in OS settings and comes back).
 *
 * expo-notifications is lazy-imported so its native module doesn't initialize
 * on the cold-start path (same rule as lib/notifications).
 */
export function useNotificationPermission() {
  const [granted, setGranted] = useState(false);

  const refresh = useCallback(async () => {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    setGranted(status === "granted");
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { granted, refresh };
}