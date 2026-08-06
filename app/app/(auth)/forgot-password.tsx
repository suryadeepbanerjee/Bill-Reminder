import { useState } from "react";
import { View, Alert } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";

import { supabase } from "../../lib/supabase/client";
import { forgotPasswordSchema, ForgotPasswordFormData } from "@shared/schemas/../";
import { humanize } from "@shared/utils/errors";

import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";

export default function ForgotPasswordScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");

  // Verify step state
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const onRequestReset = async (data: ForgotPasswordFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      // No account-existence pre-check: RLS would block it for other users'
      // emails (breaking reset entirely) AND it would be an enumeration
      // surface. GoTrue always returns 200 for unknown emails (audit finding).
      const { error: authError } = await supabase.auth.resetPasswordForEmail(data.email);
      if (authError) throw authError;
      
      setStep("verify");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const onVerifyAndReset = async () => {
    if (!otp || otp.length < 6) { setError("Please enter a valid 6-digit code."); return; }
    if (!password || password.length <= 12) { setError("Password must be greater than 12 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setError(null);
    setIsLoading(true);
    try {
      if (!isOtpVerified) {
        // 1. Verify OTP
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: getValues("email"),
          token: otp.trim(),
          type: "recovery",
        });
        if (verifyError) throw verifyError;
        
        // Mark as verified so we don't try to use the same OTP again if updateUser fails
        setIsOtpVerified(true);
      }

      // 2. Update password
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Your password has been reset successfully.");
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <AuthFormContainer
        title="Check your email"
        subtitle={`We sent a 6-digit code to ${getValues("email")}. Enter it below along with your new password.`}
      >
        <View className="gap-4">
          {error && <AlertBadge message={error} variant="error" />}

          <TextInput
            label="Verification Code"
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            autoFocus
          />

          <PasswordField
            label="New Password"
            placeholder="Enter new password"
            value={password}
            onChangeText={setPassword}
          />

          <PasswordField
            label="Confirm Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <View className="gap-3 mt-2">
            <Button
              title="Reset Password"
              variant="accent"
              fullWidth
              onPress={onVerifyAndReset}
              loading={isLoading}
              disabled={otp.length < 6 || !password || !confirmPassword}
            />
            <Button
              title="Try a different email"
              variant="ghost"
              fullWidth
              onPress={() => {
                setStep("request");
                setOtp("");
                setPassword("");
                setConfirmPassword("");
                setError(null);
                setIsOtpVerified(false);
              }}
            />
          </View>
        </View>
      </AuthFormContainer>
    );
  }

  return (
    <AuthFormContainer
      title="Reset password"
      subtitle="Enter your email and we'll send a code to reset your password"
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
              onSubmitEditing={handleSubmit(onRequestReset)}
            />
          )}
        />

        <Button
          title="Send reset code"
          variant="accent"
          fullWidth
          onPress={handleSubmit(onRequestReset)}
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
