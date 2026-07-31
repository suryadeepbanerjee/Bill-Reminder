import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase/client";
import { resetPasswordSchema, ResetPasswordFormData } from "../../schemas/auth";
import { humanize } from "../../lib/errors";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";

export default function UpdatePasswordScreen() {
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (authError) {
        setError(humanize(authError, "auth"));
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
        title="Password updated"
        subtitle="Your password has been changed successfully. You can now access your account."
      >
        <View className="gap-3 mt-6">
          <Button
            title="Go to Dashboard"
            variant="accent"
            fullWidth
            onPress={() => router.replace("/(tabs)/dashboard")}
          />
        </View>
      </AuthFormContainer>
    );
  }

  return (
    <AuthFormContainer
      title="Create new password"
      subtitle="Your new password must be different from previous used passwords."
    >
      <View className="gap-4">
        {error && <AlertBadge message={error} variant="error" />}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordField
              label="New Password"
              placeholder="Enter new password"
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.password?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordField
              label="Confirm Password"
              placeholder="Confirm new password"
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.confirmPassword?.message}
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        <View className="mt-2">
          <Button
            title="Reset Password"
            variant="accent"
            fullWidth
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
          />
        </View>
      </View>
    </AuthFormContainer>
  );
}
