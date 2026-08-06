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
 *
 * H-3 (session-fixing guard): only accept the tokens when the deep link also
 * carries a recognized Supabase auth `type` (signup / magiclink / email_change
 * / recovery, etc.). success.html forwards the `type` it received from the
 * real auth redirect. A bare `bill-reminder://callback?access_token=...`
 * link (no type) is rejected — this is the common shape of a forced deep link.
 */
export default function CallbackScreen() {
  const { access_token, refresh_token, type } = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    type?: string;
  }>();

  const VALID_TYPES = new Set([
    "signup",
    "magiclink",
    "magic_link",
    "email_change",
    "recovery",
    "invite",
    "email",
    "sms",
  ]);

  useEffect(() => {
    async function handleDeepLink() {
      if (access_token && type && VALID_TYPES.has(type)) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? "",
        });

        if (!error) {
          if (type === "recovery") {
            router.replace("/(auth)/update-password");
          } else {
            router.replace("/(tabs)/dashboard");
          }
          return;
        }
      }

      // No tokens, unrecognized type, or invalid session — send to sign-in.
      router.replace("/(auth)/sign-in");
    }

    handleDeepLink();
  }, []);

  // Brief loading state while setSession() runs.
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.accent[500]} />
      </View>
    </SafeAreaView>
  );
}
