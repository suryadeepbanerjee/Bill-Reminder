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
    setResendSent(false);
    setResendLoading(true);

    try {
      // Resolve email: route param (always set after sign-up) OR active session
      let email = paramEmail?.trim();
      if (!email) {
        const { data: { session } } = await supabase.auth.getSession();
        email = session?.user?.email;
      }
      if (!email) {
        setError("We couldn't find your email address. Please sign up again.");
        return;
      }

      const { error: resendError } = await supabase.auth.resend({
        type:    "signup",
        email,
        options: { emailRedirectTo: webRedirectUri },
      });

      if (resendError) {
        const msg = resendError.message.toLowerCase();
        // Rate limit — friendly message, preserve existing behaviour
        if (msg.includes("rate limit") || msg.includes("too many")) {
          setError("Too many attempts. Please wait a moment before trying again.");
          return;
        }
        setError(resendError.message);
        return;
      }

      // Success — start cooldown timer
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

  const subtitle = paramEmail
    ? `We sent a verification link to ${paramEmail}. Open it to activate your account.`
    : "We sent a verification link to your email. Open it to activate your account.";

  return (
    <AuthFormContainer title="Check your email" subtitle={subtitle}>
      {/* Envelope icon */}
      <View className="items-center py-6 mb-2">
        <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
          <Ionicons name="mail-open-outline" size={36} color={Colors.accent[500]} />
        </View>
      </View>

      <View className="gap-4">
        {/* Error */}
        {error && <AlertBadge message={error} variant="error" />}

        {/* Resend success — note about sign-in for already-verified case */}
        {resendSent && (
          <AlertBadge
            message="New link sent — check your inbox and spam folder. If you've already verified, sign in below."
            variant="success"
          />
        )}

        {/* PRIMARY: Resend */}
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

        {/* SECONDARY: Back to sign in */}
        <Button
          title="Back to sign in"
          variant="secondary"
          fullWidth
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>

      {/* Hint footer */}
      <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card gap-2">
        <Text className="text-caption text-neutral-500 dark:text-neutral-400 text-center leading-5">
          Can't find the email? Check your spam folder. The link expires in 24 hours.
        </Text>
        <Text className="text-caption text-neutral-400 dark:text-neutral-500 text-center leading-5">
          Already verified?{" "}
          <Text
            className="text-accent-500 font-semibold"
            onPress={() => router.replace("/(auth)/sign-in")}
          >
            Sign in →
          </Text>
        </Text>
      </View>
    </AuthFormContainer>
  );
}
