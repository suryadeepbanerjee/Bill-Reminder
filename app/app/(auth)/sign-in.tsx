import { useState } from "react";
import { Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { signInSchema, SignInFormData } from "../../schemas/auth";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { Divider } from "../../components/ui/Divider";
import { Colors } from "../../lib/theme";

export default function SignInScreen() {
  const [error, setError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [magicSent, setMagicSent]   = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [nextLoading, setNextLoading] = useState(false);
  const [notVerified, setNotVerified] = useState(false);

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

  // ── Check session when user taps Next ────────────────────────────────────
  const handleNext = async () => {
    setNotVerified(false);
    setNextLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/(tabs)/dashboard");
      } else {
        setNotVerified(true);
      }
    } catch {
      setNotVerified(true);
    } finally {
      setNextLoading(false);
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

  const handleMagicLink = async () => {
    // Email is not disabled — show error inline instead of blocking
    if (!emailValid) {
      setError("Please enter a valid email address to receive a magic link.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email:   emailValue,
        options: { emailRedirectTo: webRedirectUri },
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      setMagicEmail(emailValue);
      setMagicSent(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Waiting — user taps Next to proceed ──────────────────────────────────
  if (magicSent) {
    return (
      <AuthFormContainer
        title="Check your email"
        subtitle={`We sent a magic link to ${magicEmail}. Tap it in your email, then come back and press Next.`}
      >
        {/* Mail icon */}
        <View className="items-center py-6 mb-2">
          <View className="w-20 h-20 rounded-full bg-accent-50 dark:bg-accent-950 items-center justify-center">
            <Ionicons name="mail-open-outline" size={36} color={Colors.accent[500]} />
          </View>
        </View>

        <View className="gap-4">
          {/* Not verified feedback */}
          {notVerified && (
            <AlertBadge
              message="Please verify your email first — tap the link in your inbox, then press Next."
              variant="error"
            />
          )}

          {/* PRIMARY: Next — checks session on tap */}
          <Button
            title="Next"
            variant="accent"
            fullWidth
            onPress={handleNext}
            loading={nextLoading}
            disabled={nextLoading}
          />

          {/* SECONDARY: Try a different email */}
          <Button
            title="Try a different email"
            variant="secondary"
            fullWidth
            onPress={() => {
              setMagicSent(false);
              setMagicEmail("");
              setNotVerified(false);
            }}
          />
        </View>

        <View className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-card">
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 text-center leading-5">
            Can't find the email? Check your spam folder. The link expires in 24 hours.
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

        {/* Forgot password — right-aligned, below password */}
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

        {/* Magic link — always enabled; shows error if email missing */}
        <Button
          title="Send magic link"
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
