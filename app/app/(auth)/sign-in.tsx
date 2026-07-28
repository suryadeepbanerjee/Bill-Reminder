import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { signInSchema, SignInFormData } from "../../schemas/auth";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { Divider } from "../../components/ui/Divider";

export default function SignInScreen() {
  const [error, setError]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

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
    if (!emailValid) {
      setError("Enter a valid email address first.");
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
      setMagicSent(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (magicSent) {
    return (
      <AuthFormContainer
        title="Check your email"
        subtitle={`We sent a magic link to ${emailValue}. Tap it to sign in instantly.`}
      >
        <View className="gap-3 mt-2">
          <Button
            title="Back to sign in"
            variant="secondary"
            onPress={() => setMagicSent(false)}
          />
        </View>
      </AuthFormContainer>
    );
  }

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

        <Button
          title="Send magic link"
          variant="secondary"
          onPress={handleMagicLink}
          disabled={isLoading || !emailValid}
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
