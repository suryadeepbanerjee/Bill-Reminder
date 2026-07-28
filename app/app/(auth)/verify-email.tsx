import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { Button } from "../../components/ui/Button";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { Colors } from "../../lib/theme";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent]       = useState(false);
  const [cooldown, setCooldown]           = useState(0);
  const [error, setError]                 = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setResendLoading(true);
    try {
      // Resolve email — route param first, then active session as fallback
      let email = paramEmail?.trim();
      if (!email) {
        const { data: { session } } = await supabase.auth.getSession();
        email = session?.user?.email;
      }
      if (!email) {
        setError("Couldn't find your email address. Please sign up again.");
        return;
      }

      const { error: resendError } = await supabase.auth.resend({
        type:    "signup",
        email,
        options: { emailRedirectTo: webRedirectUri },
      });

      if (resendError) {
        if (resendError.message.toLowerCase().includes("rate limit")) {
          setError("Too many attempts. Please wait a moment before trying again.");
        } else {
          setError(resendError.message);
        }
        return;
      }

      setResendSent(true);
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
      {/* Icon */}
      <View className="items-center py-6 mb-2">
        <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
          <Ionicons name="mail-open-outline" size={36} color={Colors.accent[500]} />
        </View>
      </View>

      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        {resendSent && (
          <AlertBadge
            message="Email sent — check your inbox and spam folder. Already verified? Use the Sign in button below."
            variant="success"
          />
        )}

        {/* Already verified prompt — always visible, prominent */}
        <View className="p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-card flex-row items-start gap-3">
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color="#10b981"
            style={{ marginTop: 1 }}
          />
          <View className="flex-1">
            <Text className="text-label text-emerald-700 dark:text-emerald-300 font-semibold mb-0.5">
              Already verified your email?
            </Text>
            <Text className="text-caption text-emerald-600 dark:text-emerald-400">
              Tap Sign in below — you're ready to go.
            </Text>
          </View>
        </View>

        {/* Primary: Sign in */}
        <Button
          title="Sign in"
          variant="accent"
          fullWidth
          onPress={() => router.replace("/(auth)/sign-in")}
        />

        {/* Secondary: Resend with cooldown */}
        <Button
          title={
            cooldown > 0
              ? `Resend in ${cooldown}s`
              : resendLoading
              ? "Sending…"
              : "Resend verification email"
          }
          variant="secondary"
          fullWidth
          onPress={handleResend}
          disabled={cooldown > 0 || resendLoading}
          loading={resendLoading}
        />
      </View>

      {/* Hint */}
      <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card">
        <Text className="text-caption text-neutral-500 dark:text-neutral-400 text-center leading-5">
          Can't find the email? Check your spam folder. The link expires in 24 hours.
        </Text>
      </View>
    </AuthFormContainer>
  );
}
