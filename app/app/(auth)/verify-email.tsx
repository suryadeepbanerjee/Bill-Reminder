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

/** Returns true when the Supabase error message means "already confirmed". */
function isAlreadyVerifiedError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("already confirmed") ||
    m.includes("already verified") ||
    m.includes("email already confirmed") ||
    m.includes("user already confirmed")
  );
}

export default function VerifyEmailScreen() {
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();

  const [resendLoading, setResendLoading]   = useState(false);
  const [resendSuccess, setResendSuccess]   = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [cooldown, setCooldown]             = useState(0);
  const [error, setError]                   = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setResendSuccess(false);
    setResendLoading(true);

    try {
      // 1. Resolve email — prefer route param (always present after sign-up),
      //    fall back to an active session (e.g. deep-link re-entry).
      let email = paramEmail?.trim();
      if (!email) {
        const { data: { session } } = await supabase.auth.getSession();
        email = session?.user?.email;
      }

      if (!email) {
        setError("We couldn't find your email address. Please sign up again.");
        return;
      }

      // 2. Attempt resend
      const { error: resendError } = await supabase.auth.resend({
        type:    "signup",
        email,
        options: { emailRedirectTo: webRedirectUri },
      });

      if (resendError) {
        // Supabase returns an error when the email is already confirmed —
        // treat that as a positive "already verified" outcome, not an error.
        if (isAlreadyVerifiedError(resendError.message)) {
          setAlreadyVerified(true);
          return;
        }

        // Rate-limit — make the message friendlier
        if (resendError.message.toLowerCase().includes("rate limit")) {
          setError("Too many attempts. Please wait a moment before trying again.");
          return;
        }

        setError(resendError.message);
        return;
      }

      // 3. Success — start cooldown
      setResendSuccess(true);
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

  // ── Already-verified state ──────────────────────────────────────────────────
  if (alreadyVerified) {
    return (
      <AuthFormContainer
        title="Email verified"
        subtitle="Your email address has already been verified. You're ready to sign in."
      >
        <View className="items-center py-6 mb-4">
          <View className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950 items-center justify-center">
            <Ionicons name="checkmark-circle" size={40} color={Colors.accent[500]} />
          </View>
        </View>

        <View className="gap-3">
          <AlertBadge
            message="Your account is verified. Sign in to get started."
            variant="success"
          />

          <Button
            title="Sign in"
            variant="accent"
            fullWidth
            onPress={() => router.replace("/(auth)/sign-in")}
          />

          <Button
            title="Create a different account"
            variant="secondary"
            fullWidth
            onPress={() => router.replace("/(auth)/sign-up")}
          />
        </View>
      </AuthFormContainer>
    );
  }

  // ── Default waiting-for-verification state ──────────────────────────────────
  return (
    <AuthFormContainer
      title="Verify your email"
      subtitle="We've sent a verification link to your email address. Open it to activate your account."
    >
      {/* Icon */}
      <View className="items-center py-6 mb-4">
        <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
          <Ionicons name="mail-open-outline" size={36} color={Colors.accent[500]} />
        </View>
      </View>

      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        {resendSuccess && (
          <AlertBadge message="Verification email resent. Check your inbox." variant="success" />
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
