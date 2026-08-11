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

// Side-effect: patches expo-router's routing queue
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

// Slightly longer splash for a smoother first‑launch experience
const MIN_COVER_MS = 1200;

// Suppress self‑triggered Appearance events for this long
const SELF_TRIGGER_SUPPRESS_MS = 60;

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const { resolved, hydrated, _hydrate } = useThemeStore();
  const { setColorScheme: rawSetColorScheme } = useColorScheme();
  const resetHousehold = useHouseholdStore((s) => s.reset);
  const pathname = usePathname();

  const [coverVisible, setCoverVisible] = useState(true);
  const [minCoverDone, setMinCoverDone] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  // ── Wrapper to mark Appearance events we cause ──
  const suppressAppearanceRef = useRef(false);
  const setColorScheme = useCallback(
    (scheme: "light" | "dark") => {
      suppressAppearanceRef.current = true;
      rawSetColorScheme(scheme);
      setTimeout(() => {
        suppressAppearanceRef.current = false;
      }, SELF_TRIGGER_SUPPRESS_MS);
    },
    [rawSetColorScheme]
  );

  // ── Hydrate theme store on mount ──
  useEffect(() => {
    _hydrate();
  }, []);

  // ── Minimum cover time ──
  useEffect(() => {
    const t = setTimeout(() => setMinCoverDone(true), MIN_COVER_MS);
    return () => clearTimeout(t);
  }, []);

  // ── Release action guard on navigation ──
  useEffect(() => {
    releaseAllActions();
  }, [pathname]);

  // ── Notification listeners ──
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

  // ── Apply theme whenever `resolved` changes (after hydration) ──
  useLayoutEffect(() => {
    if (hydrated) {
      setColorScheme(resolved);
    }
  }, [resolved, hydrated, setColorScheme]);

  // ── Simplified guardian: correct mismatch when it occurs ──
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  const checkNow = useCallback(() => {
    if (!hydratedRef.current) return;
    const r = resolvedRef.current;
    if (cssColorScheme.get() !== r) {
      // Directly set the correct scheme – no flip, no veil
      setColorScheme(r);
    }
    // Once we've ensured the theme is applied, mark it ready
    setThemeReady(true);
  }, [setColorScheme]);

  // Run on hydration change and initial mount
  useEffect(() => {
    checkNow();
  }, [checkNow, hydrated]);

  // ── Listen to app state and system appearance changes ──
  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      // When the app returns to foreground, ensure the theme is correct
      checkNow();
    };

    const onAppearanceChange = () => {
      if (suppressAppearanceRef.current) return; // ignore our own updates
      // If system theme changed, we might need to reflect it? But we're using store's resolved,
      // so we just re‑apply the store's value in case the cache drifted.
      checkNow();
    };

    const appStateSub = AppState.addEventListener("change", onAppState);
    const appearanceSub = Appearance.addChangeListener(onAppearanceChange);

    return () => {
      appStateSub.remove();
      appearanceSub.remove();
    };
  }, [checkNow]);

  // ── Fail‑safe: release cover after 3.5s no matter what ──
  useEffect(() => {
    const t = setTimeout(() => {
      setThemeReady(true);
      setMinCoverDone(true);
    }, 3500);
    return () => clearTimeout(t);
  }, []);

  // ── Splash + cover gate ──
  const splashHiddenRef = useRef(false);
  const allReady = !isLoading && hydrated && themeReady && minCoverDone;

  useEffect(() => {
    if (!allReady || splashHiddenRef.current) return;
    splashHiddenRef.current = true;

    SplashScreen.hideAsync()
      .then(() => setCoverVisible(false))
      .catch(() => setCoverVisible(false));
  }, [allReady]);

  // ── Lazy CAPTCHA host ──
  const [CaptchaHost, setCaptchaHost] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    if (!isCaptchaEnabled) return;
    let mounted = true;
    import("../components/ui/CaptchaHost").then((m) => {
      if (mounted) setCaptchaHost(() => m.CaptchaHost);
    });
    return () => { mounted = false; };
  }, []);

  // ── Auth session ──
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
