import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { tempAuth } from "../../lib/tempAuth";
import { Button } from "../../components/ui/Button";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { humanize } from "@shared/utils/errors";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();

  const [resendLoading, setResendLoading]     = useState(false);
  const [resendSent, setResendSent]           = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [cooldown, setCooldown]               = useState(0);
  const [error, setError]                     = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setResendSent(false);
    setResendLoading(true);

    try {
      // ── Step 1: resolve email ────────────────────────────────────────────
      let email = paramEmail?.trim();
      if (!email) {
        const { data: { session } } = await supabase.auth.getSession();
        email = session?.user?.email;
      }
      if (!email) {
        setError("We couldn't find your email address. Please sign up again.");
        return;
      }

      // ── Step 2: detect confirmed status via sign-in ──────────────────────
      //
      // supabase.auth.resend() returns HTTP 200 for both confirmed AND
      // unconfirmed users (Supabase security design — prevents enumeration).
      // We cannot distinguish the two from the resend response alone.
      //
      // Instead: attempt a real signInWithPassword using the credentials
      // stored in tempAuth right after sign-up.
      //   • Success          → email is confirmed → auto sign-in → dashboard
      //   • "Email not confirmed" → not yet verified → proceed with resend
      //   • Any other error  → fall through to resend (don't block the user)
      const pending = tempAuth.get();
      if (pending && pending.email === email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email:    pending.email,
          password: pending.password,
        });

        if (!signInErr) {
          // Sign-in succeeded → email WAS confirmed.
          // onAuthStateChange in _layout.tsx fires and updates auth store.
          tempAuth.clear();
          router.replace("/(tabs)/dashboard");
          return;
        }

        const msg = signInErr.message.toLowerCase();
        if (!msg.includes("email not confirmed") && !msg.includes("not confirmed")) {
          // Unexpected error (wrong password? network?) — fall through to resend.
          // Don't block the user; just attempt the resend normally.
        }
        // "Email not confirmed" → fall through to resend below.
      }

      // ── Step 3: resend ───────────────────────────────────────────────────
      const { error: resendError } = await supabase.auth.resend({
        type:    "signup",
        email,
        options: { emailRedirectTo: webRedirectUri },
      });

      if (resendError) {
        const msg = resendError.message.toLowerCase();

        // Catch any "already confirmed" error Supabase might surface in future
        if (
          msg.includes("already confirmed") ||
          msg.includes("already verified") ||
          msg.includes("email exists")
        ) {
          setAlreadyVerified(true);
          return;
        }

        if (msg.includes("rate limit") || msg.includes("too many")) {
          setError("Too many attempts. Please wait a moment and try again.");
          return;
        }

        setError(humanize(resendError, "auth"));
        return;
      }

      // ── Step 4: success — start cooldown ─────────────────────────────────
      setResendSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);

    } catch {
      setError("Could not send the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const subtitle = paramEmail
    ? `We sent a verification link to ${paramEmail}. Open it to activate your account.`
    : "We sent a verification link to your email. Open it to activate your account.";

  // ── Already verified state ───────────────────────────────────────────────
  if (alreadyVerified) {
    return (
      <AuthFormContainer
        title="Email verified"
        subtitle="Your email is already verified. Sign in to access your account."
      >
        <View className="items-center py-6 mb-2">
          <View className="w-20 h-20 rounded-full bg-success/10 items-center justify-center">
            <Ionicons name="checkmark-circle" size={40} className="text-success" />
          </View>
        </View>

        <View className="gap-3">
          <AlertBadge
            message="Your email has already been verified. Please sign in."
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

  // ── Default: waiting for verification ───────────────────────────────────
  return (
    <AuthFormContainer title="Check your email" subtitle={subtitle}>
      <View className="items-center py-6 mb-2">
        <View className="w-20 h-20 rounded-full bg-accent/10 items-center justify-center">
          <Ionicons name="mail-open-outline" size={36} className="text-accent" />
        </View>
      </View>

      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        {resendSent && (
          <AlertBadge
            message="New link sent — check your inbox and spam folder."
            variant="success"
          />
        )}

        {/* PRIMARY: Resend */}
        <Button
          title={
            cooldown > 0
              ? `Resend in ${cooldown}s`
              : resendLoading
              ? "Checking…"
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

      <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card gap-2">
        <Text className="text-caption text-secondary text-center leading-5">
          Can't find the email? Check your spam folder. The link expires in 24 hours.
        </Text>
        <Text className="text-caption text-secondary text-center leading-5">
          Already verified?{" "}
          <Text
            className="text-accent font-semibold"
            onPress={() => router.replace("/(auth)/sign-in")}
          >
            Sign in →
          </Text>
        </Text>
      </View>
    </AuthFormContainer>
  );
}
