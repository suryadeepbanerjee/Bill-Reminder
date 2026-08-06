import { useState, useEffect } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { tempAuth } from "../../lib/tempAuth";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { humanize } from "@shared/utils/errors";
import { withCaptcha } from "../../lib/captcha";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();
  
  const [email, setEmail] = useState(paramEmail?.trim() || "");
  const [otpCode, setOtpCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve email if missing from params
    const resolveEmail = async () => {
      if (email) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setEmail(session.user.email);
      } else {
        const pending = tempAuth.get();
        if (pending?.email) setEmail(pending.email);
      }
    };
    resolveEmail();
  }, [email]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    const code = otpCode.trim();
    setError(null);
    setResendSent(false);

    if (!email) {
      setError("Email address is missing. Please sign up again.");
      return;
    }
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setVerifyLoading(true);
    try {
      const { error: verifyError } = await withCaptcha("otp_verify", (o) =>
        supabase.auth.verifyOtp({
          email: email,
          token: code,
          type: "signup",
          options: o,
        })
      );

      if (verifyError) {
        const msg = verifyError.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("invalid") || msg.includes("otp")) {
          setError("Incorrect or expired code. Please request a new one.");
          return;
        }
        setError(humanize(verifyError, "auth"));
        return;
      }

      // Verification successful, session established.
      tempAuth.clear();
      router.replace("/(tabs)/dashboard");
    } catch {
      setError("Could not verify the code. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendSent(false);

    if (!email) {
      setError("We couldn't find your email address. Please sign up again.");
      return;
    }

    setResendLoading(true);
    try {
      const { error: resendError } = await withCaptcha("resend_verify", (o) =>
        supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: webRedirectUri, ...o },
        })
      );

      if (resendError) {
        const msg = resendError.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("too many")) {
          setError("Too many attempts. Please wait a moment and try again.");
          return;
        }
        setError(humanize(resendError, "auth"));
        return;
      }

      setResendSent(true);
      startCooldown();
    } catch {
      setError("Could not send the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const subtitle = email
    ? `We sent a 6-digit code to ${email}. Check your inbox and enter it below.`
    : "We sent a 6-digit code to your email. Check your inbox and enter it below.";

  return (
    <AuthFormContainer title="Check your email" subtitle={subtitle}>
      <View className="items-center py-6 mb-2">
        <View className="w-20 h-20 rounded-full bg-accent/10 items-center justify-center">
          <Ionicons name="key-outline" size={36} className="text-accent" />
        </View>
      </View>

      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        {resendSent && (
          <AlertBadge
            message="New code sent — check your inbox and spam folder."
            variant="success"
          />
        )}

        {/* 6-digit code input */}
        <TextInput
          label="Verification Code"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          value={otpCode}
          onChangeText={(t) => {
            setOtpCode(t.replace(/\D/g, ""));
            setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {/* PRIMARY: Verify */}
        <Button
          title={verifyLoading ? "Verifying…" : "Verify & continue"}
          variant="accent"
          fullWidth
          onPress={handleVerify}
          disabled={verifyLoading || otpCode.length !== 6}
          loading={verifyLoading}
        />

        {/* SECONDARY: Resend */}
        <Button
          title={
            cooldown > 0
              ? `Resend code in ${cooldown}s`
              : resendLoading
              ? "Sending…"
              : "Resend code"
          }
          variant="secondary"
          fullWidth
          onPress={handleResend}
          disabled={cooldown > 0 || resendLoading || verifyLoading}
        />
        
        {/* TERTIARY: Back to sign in */}
        <Button
          title="Back to sign in"
          variant="ghost"
          fullWidth
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>

      <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card gap-2">
        <Text className="text-caption text-secondary text-center leading-5">
          Can't find the email? Check your spam folder. The code expires in 24 hours.
        </Text>
      </View>
    </AuthFormContainer>
  );
}
