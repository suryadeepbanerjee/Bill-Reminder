import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Appearance, type AppStateStatus, View, ActivityIndicator } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import { cssInterop } from "nativewind";
import { colorScheme as cssColorScheme } from "react-native-css-interop";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/auth-store";
import { useThemeStore } from "../stores/theme-store";
import { useHouseholdStore } from "../stores/household-store";
import { supabase } from "../lib/supabase/client";
import { ThemeTransition } from "../components/ui/ThemeTransition";
import { isCaptchaEnabled } from "../lib/captcha";

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
  const themeTimersRef = useRef<ReturnType<typeof setTimeout>[] | null>(null);

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

  useLayoutEffect(() => {
    setColorScheme(resolved);
  }, [resolved, setColorScheme]);

  // Android drops the manual color-scheme override (Appearance.setColorScheme)
  // during background/foreground round-trips — e.g. returning from the Google
  // Sign-In activity or waking the phone after the screen was off — and
  // css-interop then re-reads the device value into its systemColorScheme on
  // the next 'active'/appearance event, repainting every CSS-variable surface
  // with the wrong palette. Our setColorScheme() call alone does NOT update
  // css-interop's cache — the cache only converges from native appearance
  // events, and if such an event arrives with a null/stale value the cache
  // stays wrong indefinitely. Watchdog: (1) re-apply the intent on every
  // app-state/appearance event, (2) while foregrounded, compare the ACTUAL
  // css-interop cache against the intent and re-apply on mismatch, and (3) as
  // a last resort perform the same quick dark↔light double flip that manually
  // re-syncs the cache when the native event round-trip fails.
  useEffect(() => {
    const apply = () => setColorScheme(resolved);

    // If the native override round-trip didn't converge the cache, force it:
    // flipping the scheme twice produces concrete appearance events which
    // css-interop converts into a deterministic cache value.
    const flipFallback = () => {
      const timer = setTimeout(() => {
        if (cssColorScheme.get() === resolved) return;
        setColorScheme(resolved === "dark" ? "light" : "dark");
        setTimeout(() => setColorScheme(resolved), 220);
      }, 450);
      themeTimersRef.current?.push(timer);
    };

    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      apply();
      // Staggered reasserts: the OS can re-sync the scheme AFTER the
      // foreground event (activity recreation / config change on wake) and
      // css-interop then repaints with the device value. Re-applying the
      // stored intent a few times after the transition wins that race.
      themeTimersRef.current = [350, 800].map((ms) => setTimeout(apply, ms));
      flipFallback();
    };

    const appStateSub = AppState.addEventListener("change", onAppState);
    const appearanceSub = Appearance.addChangeListener(apply);

    // Foreground watchdog — the cache is the paint source; if it ever
    // disagrees with the stored intent, force it back.
    const interval = setInterval(() => {
      if (AppState.currentState !== "active") return;
      if (cssColorScheme.get() === resolved) return;
      apply();
      flipFallback();
    }, 1200);

    return () => {
      appStateSub.remove();
      appearanceSub.remove();
      clearInterval(interval);
      themeTimersRef.current?.forEach(clearTimeout);
      themeTimersRef.current = null;
    };
  }, [resolved, setColorScheme]);

  // Lazy-mount the CAPTCHA popup host (react-native-webview is a native
  // module — never on the cold-start path). Only loads when a site key is
  // configured AND someone actually requests a token.
  const [CaptchaHost, setCaptchaHost] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    if (!isCaptchaEnabled) return;
    let mounted = true;
    import("../components/ui/CaptchaHost").then((m) => {
      if (mounted) setCaptchaHost(() => m.CaptchaHost);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Hide the splash as soon as the first frame paints — the LoadingScreen
    // below uses the new splash artwork's ambient tone (#D17D00), so the
    // gold splash → loading handoff is seamless and auth restore (SecureStore
    // read) never blocks perceived launch.
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
      <View style={{ flex: 1 }}>
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
        {/* Buffer screen that hides the theme swap behind an animated cover. */}
        <ThemeTransition />
        {/* CAPTCHA popup (lazy — only mounts when the site key is configured). */}
        {CaptchaHost && <CaptchaHost />}
        {/* Overlay the loading screen until the session has been restored.
            Rendered on top of Stack so it covers all screens, and dismissed
            automatically once isLoading → false (no Stack remount needed). */}
        {isLoading && (
          <View
            style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center", justifyContent: "center",
              backgroundColor: "#D17D00",
            }}
          >
            <ActivityIndicator size="large" color="#080810" />
          </View>
        )}
      </View>
    </QueryClientProvider>
  );
}
