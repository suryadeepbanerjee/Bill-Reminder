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
  const guardianTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // ── Theme guardian ─────────────────────────────────────────────────────────
  // Android drops the manual color-scheme override (Appearance.setColorScheme)
  // during background/foreground round-trips (Google Sign-In activity, waking
  // the phone after the screen was off) and on cold start, after which
  // css-interop re-reads the DEVICE value into its systemColorScheme on the
  // next 'active'/appearance event and repaints every CSS-variable surface
  // with the wrong palette. Our setColorScheme() call does NOT update
  // css-interop's cache — the cache only converges from native appearance
  // events, which some devices deliver slowly or with null values.
  //
  // The guardian treats css-interop's cache as the paint source:
  //   1. `themeReady` keeps the splash/loading cover up on cold start until
  //      the first convergence, so the wrong palette can never be seen.
  //   2. While foregrounded it polls the cache against the stored intent; on
  //      any mismatch it drops an opaque canvas-colored veil, forces
  //      convergence with the dark↔light double-flip that reliably produces
  //      concrete appearance events, and lifts the veil once the cache
  //      matches — so a wake/login flip is fixed in a few hundred ms behind
  //      an invisible buffer instead of flashing the broken palette.
  //   Skipped entirely while a user-initiated theme toggle is in flight
  //   (mode !== resolved) — ThemeTransition owns that window.
  const mode = useThemeStore((s) => s.mode);
  const [themeVeil, setThemeVeil] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const veilStateRef = useRef(false);

  const forceConverge = useCallback(() => {
    const r = resolvedRef.current;
    if (veilStateRef.current) return; // already converging
    veilStateRef.current = true;
    setThemeVeil(true);
    setColorScheme(r === "dark" ? "light" : "dark");
    const flipTimer = setTimeout(() => {
      setColorScheme(r);
      const started = Date.now();
      const checkTimer = setInterval(() => {
        if (cssColorScheme.get() === r || Date.now() - started > 1500) {
          clearInterval(checkTimer);
          veilStateRef.current = false;
          setThemeVeil(false);
          setThemeReady(true);
        }
      }, 60);
      guardianTimersRef.current.push(checkTimer);
    }, 130);
    guardianTimersRef.current.push(flipTimer);
  }, [setColorScheme]);

  const checkNow = useCallback(() => {
    if (modeRef.current !== resolvedRef.current) return; // toggle in flight
    if (veilStateRef.current) return; // already converging
    if (cssColorScheme.get() === resolvedRef.current) {
      setThemeReady(true);
      return;
    }
    forceConverge();
  }, [forceConverge]);

  useEffect(() => {
    // Cold start: cover the first frames until the cache matches the intent.
    checkNow();
  }, [checkNow]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      setColorScheme(resolved);
      checkNow();
    };
    const appStateSub = AppState.addEventListener("change", onAppState);
    const appearanceSub = Appearance.addChangeListener(() => {
      setColorScheme(resolved);
      checkNow();
    });
    // Fast foreground poll — the cache is the paint source; any mismatch is
    // veiled and converged within a few hundred ms.
    const interval = setInterval(() => {
      if (AppState.currentState !== "active") return;
      checkNow();
    }, 150);
    return () => {
      appStateSub.remove();
      appearanceSub.remove();
      clearInterval(interval);
      guardianTimersRef.current.forEach(clearTimeout);
      guardianTimersRef.current = [];
    };
  }, [checkNow, resolved, setColorScheme]);

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
        {/* Flip-guard veil — opaque canvas-colored cover shown while the
            guardian force-converges the color scheme after a wake/login flip;
            invisible to the user (same color as the intended canvas). */}
        {themeVeil && (
          <View
            style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: tokensFor(resolved).canvas,
            }}
          />
        )}
        {/* Buffer screen that hides the theme swap behind an animated cover. */}
        <ThemeTransition />
        {/* CAPTCHA popup (lazy — only mounts when the site key is configured). */}
        {CaptchaHost && <CaptchaHost />}
        {/* Overlay the loading screen until the session has been restored AND
            the color scheme has converged (cold start), so the first frames
            the user sees are always the correct theme. */}
        {(isLoading || !themeReady) && (
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
