import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import { cssInterop } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/auth-store";
import { useThemeStore } from "../stores/theme-store";
import { useHouseholdStore } from "../stores/household-store";
import { supabase } from "../lib/supabase/client";

// Side-effect: patches expo-router's routing queue so every navigation call
// (router.*, Link, Redirect) is deduped per destination — silent, cooldown-based.
import "../lib/guarded-navigation";
import { releaseAllActions } from "@shared/utils/action-guard";

SplashScreen.preventAutoHideAsync();

// Smooth crossfade when the splash is dismissed (expo-splash-screen >= 31).
SplashScreen.setOptions({ duration: 200, fade: true });

cssInterop(Ionicons, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    },
  },
});


export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const { resolved, _hydrate } = useThemeStore();
  const { setColorScheme } = useColorScheme();
  const resetHousehold = useHouseholdStore((s) => s.reset);
  const pathname = usePathname();

  useEffect(() => {
    _hydrate();
  }, []);

  useEffect(() => {
    // Screen blur / navigation: release any in-flight guard locks so the
    // dedupe state never leaks across screens or sticks after a remount.
    releaseAllActions();
  }, [pathname]);

  useEffect(() => {
    // Lazy-load expo-notifications so its native module doesn't init during
    // cold start — notification listeners aren't needed before the UI paints.
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    import("../lib/notifications").then((m) => {
      if (mounted) unsubscribe = m.setupNotificationListeners();
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setColorScheme(resolved);
  }, [resolved, setColorScheme]);

  useEffect(() => {
    // Hide the splash as soon as the first frame paints — the LoadingScreen
    // below uses the same background (#080810), so the handoff is seamless
    // and auth restore (SecureStore read) never blocks perceived launch.
    SplashScreen.hideAsync();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      SplashScreen.hideAsync();
      if (session) {
        import("../lib/notifications").then(m => m.syncLocalReminders());
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        import("../lib/notifications").then(m => m.syncLocalReminders());
      } else {
        resetHousehold();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Always render the full navigator tree so the navigation context is
  // available even during the initial session-restore (cold start).  Keeping
  // <Stack> mounted means deep-link handlers, notification taps, and
  // onAuthStateChange callbacks can safely call router.* at any point without
  // triggering "Couldn't find a navigation context".
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }} className={resolved === "dark" ? "dark" : ""}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="bill/[id]" />
          <Stack.Screen name="callback" />
          <Stack.Screen name="accept-invite" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-bill"
            options={{
              presentation: "modal",
              headerShown: false,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
        {/* Overlay the loading screen until the session has been restored.
            Rendered on top of Stack so it covers all screens, and dismissed
            automatically once isLoading → false (no Stack remount needed). */}
        {isLoading && (
          <View
            style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center", justifyContent: "center",
              backgroundColor: "#080810",
            }}
          >
            <ActivityIndicator size="large" color="#D1A920" />
          </View>
        )}
      </View>
    </QueryClientProvider>
  );
}
