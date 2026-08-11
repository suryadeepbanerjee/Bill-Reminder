import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { tokensFor } from "../lib/tokens";
import { isCaptchaEnabled } from "../lib/captcha";
import { ThemeTransition } from "../components/ui/ThemeTransition";

import "../lib/guarded-navigation";
import { releaseAllActions } from "@shared/utils/action-guard";

SplashScreen.preventAutoHideAsync();

const SPLASH_FADE_MS = 300;
SplashScreen.setOptions({ duration: SPLASH_FADE_MS, fade: true });

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

const MIN_COVER_MS = 1600;

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const { resolved, hydrated, _hydrate } = useThemeStore();
  const { setColorScheme: rawSetColorScheme } = useColorScheme();
  const resetHousehold = useHouseholdStore((s) => s.reset);
  const pathname = usePathname();

  const [coverVisible, setCoverVisible] = useState(true);
  const [minCoverDone, setMinCoverDone] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  // Wrapper around NativeWind’s setter – no suppression needed now
  const setColorScheme = useCallback(
    (scheme: "light" | "dark") => {
      rawSetColorScheme(scheme);
    },
    [rawSetColorScheme]
  );

  // Hydrate theme store on mount
  useEffect(() => {
    _hydrate();
  }, []);

  // Minimum cover time
  useEffect(() => {
    const t = setTimeout(() => setMinCoverDone(true), MIN_COVER_MS);
    return () => clearTimeout(t);
  }, []);

  // Release action guard on navigation
  useEffect(() => {
    releaseAllActions();
  }, [pathname]);

  // Notification listeners
  useEffect(() => {
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

  // Apply theme whenever `resolved` changes after hydration
  useLayoutEffect(() => {
    if (hydrated) {
      setColorScheme(resolved);
    }
  }, [resolved, hydrated, setColorScheme]);

  // Store latest resolved in a ref for the foreground sync
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  // Robust sync on return to foreground
  useEffect(() => {
    const handleActive = () => {
      // Small delay ensures the theme store has processed any system change
      const timer = setTimeout(() => {
        // Force NativeWind to match the store’s resolved theme
        setColorScheme(resolvedRef.current);
        setThemeReady(true);
      }, 50);

      return () => clearTimeout(timer);
    };

    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") handleActive();
    });

    return () => subscription.remove();
  }, [setColorScheme]);

  // Listen to system appearance changes as a fallback
  const lastFlipAtRef = useRef(0);
  useEffect(() => {
    const onAppearanceChange = () => {
      const r = resolvedRef.current;
      if (cssColorScheme.get() === r) {
        // Already in sync — cold-start signal that the cover may drop.
        setThemeReady(true);
        return;
      }
      const now = Date.now();
      if (now - lastFlipAtRef.current > 400) {
        // The OS re-applied the system scheme (our single corrections are not
        // enough on wake). A plain re-apply may emit no native event, but the
        // quick dark↔light double flip always does, so the pages repaint back.
        lastFlipAtRef.current = now;
        setColorScheme(r === "dark" ? "light" : "dark");
        flipTimerRef.current = setTimeout(() => setColorScheme(r), 120);
      } else {
        // This event is an echo of our own flip — settle straight on the intent.
        setColorScheme(r);
      }
      setThemeReady(true);
    };

    const appearanceSub = Appearance.addChangeListener(onAppearanceChange);
    return () => appearanceSub.remove();
  }, [setColorScheme]);

  // Foreground watchdog — css-interop's JS cache is the paint source for every
  // CSS-variable surface. On wake, the OS re-applies the SYSTEM scheme a tick
  // after our single correction (NativeWind keeps its own internal Appearance
  // subscription), flipping the pages to the wrong palette while the
  // store-driven navbar stays right. Poll the cache and force it to match the
  // stored intent: a plain re-apply may emit no native event, but the quick
  // dark↔light double flip always does, so the pages repaint back.
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const check = () => {
      if (AppState.currentState !== "active") return;
      const r = resolvedRef.current;
      if (cssColorScheme.get() === r) {
        // Cold-start signal: the scheme has genuinely converged — the cover
        // may drop even if the OS never delivered an appearance event.
        setThemeReady(true);
        return;
      }
      lastFlipAtRef.current = Date.now();
      setColorScheme(r === "dark" ? "light" : "dark");
      flipTimerRef.current = setTimeout(() => setColorScheme(r), 120);
    };
    const interval = setInterval(check, 150);
    return () => {
      clearInterval(interval);
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, [setColorScheme]);

  // Fail‑safe: release cover after 3.5s no matter what
  useEffect(() => {
    const t = setTimeout(() => {
      setThemeReady(true);
      setMinCoverDone(true);
    }, 3500);
    return () => clearTimeout(t);
  }, []);

  // Splash + cover gate
  const splashHiddenRef = useRef(false);
  const allReady = !isLoading && hydrated && themeReady && minCoverDone;

  useEffect(() => {
    if (!allReady || splashHiddenRef.current) return;
    splashHiddenRef.current = true;

    SplashScreen.hideAsync()
      .then(() => setCoverVisible(false))
      .catch(() => setCoverVisible(false));
  }, [allReady]);

  // Lazy CAPTCHA host
  const [CaptchaHost, setCaptchaHost] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    if (!isCaptchaEnabled) return;
    let mounted = true;
    import("../components/ui/CaptchaHost").then((m) => {
      if (mounted) setCaptchaHost(() => m.CaptchaHost);
    });
    return () => { mounted = false; };
  }, []);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        import("../lib/notifications").then((m) => m.syncLocalReminders());
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        import("../lib/notifications").then((m) => m.syncLocalReminders());
      } else {
        resetHousehold();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canvasColor = tokensFor(resolved).canvas;

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1, backgroundColor: canvasColor }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: canvasColor },
          }}
        >
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
              contentStyle: { backgroundColor: canvasColor },
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>

        <StatusBar style={resolved === "dark" ? "light" : "dark"} />

        {/* Animated cover that hides the theme swap behind the sun/moon buffer
            scene when the user toggles the theme */}
        <ThemeTransition />

        {CaptchaHost && <CaptchaHost />}

        {coverVisible && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
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
