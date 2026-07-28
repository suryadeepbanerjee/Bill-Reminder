import { useState, useEffect } from "react";
import { Text, View, AppState } from "react-native";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase/client";
import { signInSchema, SignInFormData } from "../../schemas/auth";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { Divider } from "../../components/ui/Divider";
import { Colors } from "../../lib/theme";

const OTP_RESEND_COOLDOWN = 60;

export default function SignInScreen() {
  const [error, setError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [magicSent, setMagicSent]   = useState(false);
  const [magicEmail, setMagicEmail] = useState("");

  // OTP code state
  const [otpCode, setOtpCode]           = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError]         = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const emailValue = watch("email");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  // ── Auto-navigate if deep link fires while waiting ───────────────────────
  // If the user happens to have tapped the magic link in browser and the OS
  // opened the app via deep link → callback.tsx sets the session → this
  // AppState listener catches the session and navigates to dashboard.
  useEffect(() => {
    if (!magicSent) return;
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) router.replace("/(tabs)/dashboard");
      }
    });
    return () => sub.remove();
  }, [magicSent]);

  // ── Handle OTP code verification (PRIMARY path on mobile) ────────────────
  // supabase.auth.verifyOtp() creates the session directly on the mobile
  // Supabase client — no browser, no deep link needed.
  const handleVerify = async () => {
    const code = otpCode.trim();
    if (!code) {
      setOtpError("Please enter the 6-digit code from your email.");
      return;
    }
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setOtpError("The code must be exactly 6 digits.");
      return;
    }
    setOtpError(null);
    setVerifyLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: magicEmail,
        token: code,
        type:  "email",
      });
      if (verifyErr) {
        const msg = verifyErr.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("invalid") || msg.includes("otp")) {
          setOtpError("Code is incorrect or has expired. Request a new one below.");
          return;
        }
        setOtpError(verifyErr.message);
        return;
      }
      // Session created on mobile directly — no deep link needed.
      router.replace("/(tabs)/dashboard");
    } catch {
      setOtpError("Could not verify the code. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Send / resend OTP ────────────────────────────────────────────────────
  // No emailRedirectTo → Supabase sends a 6-digit OTP code in the email
  // instead of (or alongside) a magic link. This is the correct native
  // mobile flow per Supabase docs.
  const sendOtp = async (email: string): Promise<boolean> => {
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpErr) {
      setError(otpErr.message);
      return false;
    }
    return true;
  };

  const startCooldown = () => {
    setResendCooldown(OTP_RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleMagicLink = async () => {
    if (!emailValid) {
      setError("Please enter a valid email address to receive a sign-in code.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const ok = await sendOtp(emailValue);
      if (!ok) return;
      setMagicEmail(emailValue);
      setMagicSent(true);
      startCooldown();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setOtpError(null);
    setOtpCode("");
    setIsLoading(true);
    try {
      await sendOtp(magicEmail);
      startCooldown();
    } catch {
      setOtpError("Could not resend the code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: SignInFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email:    data.email,
        password: data.password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.replace("/(tabs)/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP code entry state ──────────────────────────────────────────────────
  if (magicSent) {
    return (
      <AuthFormContainer
        title="Enter your code"
        subtitle={`We sent a 6-digit sign-in code to ${magicEmail}. Open your email and enter it below.`}
      >
        {/* Mail icon */}
        <View className="items-center py-6 mb-2">
          <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
            <Ionicons name="key-outline" size={36} color={Colors.accent[500]} />
          </View>
        </View>

        <View className="gap-4">
          {otpError && <AlertBadge message={otpError} variant="error" />}

          {/* Code input */}
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
            onSubmitEditing={handleVerify}
          />

          {/* PRIMARY: Verify */}
          <Button
            title={verifyLoading ? "Verifying…" : "Verify & sign in"}
            variant="accent"
            fullWidth
            onPress={handleVerify}
            loading={verifyLoading}
            disabled={verifyLoading || otpCode.length !== 6}
          />

          {/* Resend */}
          <Button
            title={
              resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : isLoading
                ? "Sending…"
                : "Resend code"
            }
            variant="secondary"
            fullWidth
            onPress={handleResend}
            disabled={resendCooldown > 0 || isLoading || verifyLoading}
            loading={isLoading}
          />

          {/* Try different email */}
          <Button
            title="Try a different email"
            variant="ghost"
            fullWidth
            onPress={() => {
              setMagicSent(false);
              setMagicEmail("");
              setOtpCode("");
              setOtpError(null);
              setResendCooldown(0);
            }}
          />
        </View>

        <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card">
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 text-center leading-5">
            Can't find the email? Check your spam folder. The code expires in 10 minutes.
          </Text>
        </View>
      </AuthFormContainer>
    );
  }

  // ── Sign in form ──────────────────────────────────────────────────────────
  return (
    <AuthFormContainer
      title="Welcome back"
      subtitle="Sign in to continue tracking your bills"
    >
      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Email"
              placeholder="your@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordField
              label="Password"
              placeholder="Your password"
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.password?.message}
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        {/* Forgot password */}
        <View className="items-end -mt-1">
          <Link href="/(auth)/forgot-password" asChild>
            <Text className="text-caption text-accent-500 font-medium">
              Forgot password?
            </Text>
          </Link>
        </View>

        <Button
          title="Sign in"
          variant="accent"
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          fullWidth
        />

        <View className="flex-row items-center gap-3 my-1">
          <Divider className="flex-1" />
          <Text className="text-caption text-neutral-400">or</Text>
          <Divider className="flex-1" />
        </View>

        {/* Send sign-in code — always tappable, shows error if email missing */}
        <Button
          title="Send sign-in code"
          variant="secondary"
          onPress={handleMagicLink}
          disabled={isLoading}
          fullWidth
        />
      </View>

      {/* Footer */}
      <View className="flex-row justify-center mt-8 gap-1">
        <Text className="text-body text-neutral-500">Don't have an account?</Text>
        <Link href="/(auth)/sign-up" asChild>
          <Text className="text-body text-neutral-900 dark:text-neutral-100 font-semibold">
            Sign up
          </Text>
        </Link>
      </View>
    </AuthFormContainer>
  );
}
