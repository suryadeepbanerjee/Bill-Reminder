import { useState } from "react";
import { Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase/client";
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

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

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

        {/* OTP code sign-in — no browser, no magic link, code goes to email */}
        <Button
          title="Sign in with code"
          variant="secondary"
          onPress={() => router.push("/(auth)/sign-in-otp")}
          disabled={isLoading}
          fullWidth
        />
      </View>

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
