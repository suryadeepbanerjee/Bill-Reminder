import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
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
import { setupNotificationListeners } from "../lib/notifications";
import { Colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

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

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#080810" }}>
      <ActivityIndicator size="large" color={Colors.accent[500]} />
    </View>
  );
}

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const { resolved, _hydrate } = useThemeStore();
  const { setColorScheme } = useColorScheme();
  const resetHousehold = useHouseholdStore((s) => s.reset);

  useEffect(() => {
    _hydrate();
  }, []);

  useEffect(() => {
    const unsubscribe = setupNotificationListeners();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setColorScheme(resolved);
  }, [resolved, setColorScheme]);

  useEffect(() => {
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

  if (isLoading) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoadingScreen />
      </QueryClientProvider>
    );
  }

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
      </View>
    </QueryClientProvider>
  );
}
