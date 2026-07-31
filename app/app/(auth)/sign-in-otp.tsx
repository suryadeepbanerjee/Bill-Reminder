import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase/client";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { humanize } from "../../lib/errors";

const RESEND_COOLDOWN = 60;

type State = "email" | "otp";

export default function SignInOtpScreen() {
  const [state, setState]       = useState<State>("email");
  const [email, setEmail]       = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [otpCode, setOtpCode]         = useState("");
  const [otpError, setOtpError]       = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cooldown, setCooldown]       = useState(0);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // ── Send OTP ─────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setEmailError(null);
    if (!emailValid) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setSendLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        setEmailError(humanize(error, "auth"));
        return;
      }
      setState("otp");
      startCooldown();
    } catch {
      setEmailError("Could not send the code. Please try again.");
    } finally {
      setSendLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    setOtpError(null);
    setSuccessMsg(null);
    setOtpCode("");
    setSendLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        setOtpError(humanize(error, "auth"));
        return;
      }
      setSuccessMsg("New code sent — check your inbox.");
      startCooldown();
    } catch {
      setOtpError("Could not resend. Please try again.");
    } finally {
      setSendLoading(false);
    }
  };

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otpCode.trim();
    setOtpError(null);
    setSuccessMsg(null);

    if (!code) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setOtpError("The code must be exactly 6 digits.");
      return;
    }

    setVerifyLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type:  "email",
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("otp") || msg.includes("invalid")) {
          setOtpError("Incorrect or expired code. Request a new one.");
          return;
        }
        setOtpError(humanize(error, "auth"));
        return;
      }
      // Session created on the mobile Supabase client — navigate to dashboard.
      router.replace("/(tabs)/dashboard");
    } catch {
      setOtpError("Could not verify the code. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Screen 1: Email entry ─────────────────────────────────────────────────
  if (state === "email") {
    return (
      <AuthFormContainer
        title="Sign in with code"
        subtitle="Enter your email and we'll send you a 6-digit sign-in code."
      >
        <View className="gap-4 mt-2">
          {emailError && <AlertBadge message={emailError} variant="error" />}

          <TextInput
            label="Email"
            placeholder="your@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoFocus
            returnKeyType="done"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailError(null);
            }}
            onSubmitEditing={sendOtp}
          />

          <Button
            title={sendLoading ? "Sending…" : "Send code"}
            variant="accent"
            fullWidth
            onPress={sendOtp}
            loading={sendLoading}
            disabled={sendLoading}
          />

          <Button
            title="Back to sign in"
            variant="secondary"
            fullWidth
            onPress={() => router.back()}
          />
        </View>
      </AuthFormContainer>
    );
  }

  // ── Screen 2: OTP entry ───────────────────────────────────────────────────
  return (
    <AuthFormContainer
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${email}. Check your inbox and enter it below.`}
    >
      {/* Key icon */}
      <View className="items-center py-6 mb-2">
        <View className="w-20 h-20 rounded-full bg-accent/10 items-center justify-center">
          <Ionicons name="key-outline" size={36} className="text-accent" />
        </View>
      </View>

      <View className="gap-4">
        {otpError  && <AlertBadge message={otpError}  variant="error"   />}
        {successMsg && <AlertBadge message={successMsg} variant="success" />}

        {/* 6-digit code input */}
        <TextInput
          label="6-digit code"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          value={otpCode}
          onChangeText={(t) => {
            setOtpCode(t.replace(/\D/g, ""));
            setOtpError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={verifyOtp}
        />

        {/* PRIMARY: Verify */}
        <Button
          title={verifyLoading ? "Verifying…" : "Verify & sign in"}
          variant="accent"
          fullWidth
          onPress={verifyOtp}
          loading={verifyLoading}
          disabled={verifyLoading || otpCode.length !== 6}
        />

        {/* Resend */}
        <Button
          title={
            cooldown > 0
              ? `Resend code in ${cooldown}s`
              : sendLoading
              ? "Sending…"
              : "Resend code"
          }
          variant="secondary"
          fullWidth
          onPress={resendOtp}
          disabled={cooldown > 0 || sendLoading || verifyLoading}
        />

        {/* Change email */}
        <Button
          title="Use a different email"
          variant="ghost"
          fullWidth
          onPress={() => {
            setState("email");
            setOtpCode("");
            setOtpError(null);
            setSuccessMsg(null);
            setCooldown(0);
          }}
        />
      </View>

      <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card">
        <Text className="text-caption text-secondary text-center leading-5">
          Can't find it? Check your spam folder. The code expires in 10 minutes.
        </Text>
      </View>
    </AuthFormContainer>
  );
}
