import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase/client";
import { Colors } from "../lib/theme";

/**
 * CallbackScreen — handles the `bill-reminder://callback` deep link.
 *
 * Invoked when the user taps "Back to App" on success.html after email
 * verification. success.html encodes the access_token + refresh_token in
 * the deep link query string.
 *
 * Flow:
 *   1. Read access_token + refresh_token from URL params
 *   2. Call supabase.auth.setSession() to restore the authenticated session
 *   3. onAuthStateChange in _layout.tsx fires → updates auth store
 *   4. Navigate to dashboard (tabs layout guard will keep them there)
 *
 * If tokens are absent or invalid → fall back to the sign-in screen.
 */
export default function CallbackScreen() {
  const { access_token, refresh_token } = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
  }>();

  useEffect(() => {
    async function handleDeepLink() {
      if (access_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? "",
        });

        if (!error) {
          // Session restored — onAuthStateChange in _layout.tsx will update
          // the auth store; navigate directly to dashboard.
          router.replace("/(tabs)/dashboard");
          return;
        }
      }

      // No tokens or invalid session — send to sign-in.
      router.replace("/(auth)/sign-in");
    }

    handleDeepLink();
  }, []);

  // Brief loading state while setSession() runs.
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.accent[500]} />
      </View>
    </SafeAreaView>
  );
}
