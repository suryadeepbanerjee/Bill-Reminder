import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useAuthStore } from "../stores/auth-store";
import { useThemeStore } from "../stores/theme-store";
import { supabase } from "../lib/supabase/client";
import { Colors } from "../lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 0, staleTime: 30000 },
  },
});

function LoadingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.accent[500]} />
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const { resolved, _hydrate } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  // Hydrate theme from persisted store on first mount
  useEffect(() => {
    _hydrate();
  }, []);

  // Sync resolved theme with NativeWind
  useEffect(() => {
    setColorScheme(resolved);
  }, [resolved, setColorScheme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoadingScreen />
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="bill/[id]" />
        {/* Deep-link callback — handles bill-reminder://callback after email verification */}
        <Stack.Screen name="callback" />
        {/* Add Bill — full-screen modal over tab bar */}
        <Stack.Screen
          name="add-bill"
          options={{
            presentation:  "modal",
            headerShown:   false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
    </QueryClientProvider>
  );
}
