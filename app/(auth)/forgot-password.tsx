import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { supabase, redirectUri } from "../../lib/supabase/client";
import { forgotPasswordSchema, ForgotPasswordFormData } from "../../schemas/auth";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { Colors } from "../../lib/theme";

export default function ForgotPasswordScreen() {
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        data.email,
        { redirectTo: redirectUri }
      );
      if (authError) {
        setError(authError.message);
        return;
      }
      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthFormContainer
        title="Check your email"
        subtitle={`We sent a reset link to ${getValues("email")}. Check your inbox and follow the link.`}
      >
        <View className="items-center py-4 mb-6">
          <View className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950 items-center justify-center">
            <Ionicons name="mail-outline" size={32} color={Colors.emerald[600]} />
          </View>
        </View>
        <View className="gap-3">
          <Button
            title="Back to sign in"
            variant="accent"
            fullWidth
            onPress={() => router.replace("/(auth)/sign-in")}
          />
          <Button
            title="Try a different email"
            variant="ghost"
            fullWidth
            onPress={() => setSuccess(false)}
          />
        </View>
      </AuthFormContainer>
    );
  }

  return (
    <AuthFormContainer
      title="Reset password"
      subtitle="Enter your email and we'll send a link to reset your password"
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
              returnKeyType="done"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.email?.message}
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        <Button
          title="Send reset link"
          variant="accent"
          fullWidth
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
        />

        <Button
          title="Back to sign in"
          variant="ghost"
          fullWidth
          onPress={() => router.back()}
        />
      </View>
    </AuthFormContainer>
  );
}
