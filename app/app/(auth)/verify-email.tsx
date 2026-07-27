import { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, redirectUri } from "../../lib/supabase/client";
import { Button } from "../../components/ui/Button";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { Colors } from "../../lib/theme";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown]           = useState(0);
  const [error, setError]                 = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setResendLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) {
        setError("Session expired. Please sign up again.");
        return;
      }

      const { error: resendError } = await supabase.auth.resend({
        type:  "signup",
        email,
        options: { emailRedirectTo: redirectUri },
      });
      if (resendError) {
        setError(resendError.message);
        return;
      }

      setResendSuccess(true);
      // Cooldown timer
      setCooldown(RESEND_COOLDOWN_SECONDS);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError("Could not resend the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthFormContainer
      title="Verify your email"
      subtitle="We've sent a verification link to your email address. Open it to activate your account."
    >
      {/* Illustration block */}
      <View className="items-center py-6 mb-4">
        <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
          <Ionicons name="mail-open-outline" size={36} color={Colors.accent[500]} />
        </View>
      </View>

      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        {resendSuccess && (
          <AlertBadge message="Verification email resent successfully." variant="success" />
        )}

        {/* Resend button with cooldown */}
        <Button
          title={
            cooldown > 0
              ? `Resend in ${cooldown}s`
              : resendLoading
              ? "Sending…"
              : "Resend verification email"
          }
          variant="accent"
          fullWidth
          onPress={handleResend}
          disabled={cooldown > 0 || resendLoading}
          loading={resendLoading}
        />

        <Button
          title="Back to sign in"
          variant="secondary"
          fullWidth
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>

      {/* Hint */}
      <View className="mt-8 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card">
        <Text className="text-caption text-neutral-500 dark:text-neutral-400 text-center leading-5">
          Can't find the email? Check your spam folder. The link expires in 24 hours.
        </Text>
      </View>
    </AuthFormContainer>
  );
}
