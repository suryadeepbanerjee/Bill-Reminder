import { useState } from "react";
import { Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FontAwesome } from "@expo/vector-icons";
import { supabase, webRedirectUri } from "../../lib/supabase/client";
import { signInWithGoogle } from "../../lib/auth/google";
import { tempAuth } from "../../lib/tempAuth";
import { signUpSchema, SignUpFormData } from "@shared/schemas/../";
import { humanize } from "@shared/utils/errors";
import { withCaptcha } from "../../lib/captcha";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { PasswordField } from "../../components/ui/PasswordField";
import { AlertBadge } from "../../components/ui/AlertBadge";
import { AuthFormContainer } from "../../components/ui/AuthFormContainer";
import { Divider } from "../../components/ui/Divider";

/** Simple password strength indicator — 0..4 */
function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 12)                     score++;
  if (/[A-Z]/.test(pw))                   score++;
  if (/[0-9]/.test(pw))                   score++;
  if (/[^A-Za-z0-9]/.test(pw))            score++;
  return score;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"] as const;
const strengthColor = [
  "",
  "bg-red-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-emerald-500",
] as const;

export default function SignUpScreen() {
  const [error, setError]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const anyLoading = isLoading || googleLoading;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", displayName: "" },
    mode: "onBlur",
  });

  const passwordValue = watch("password") ?? "";
  const strength      = passwordStrength(passwordValue);

  const onSubmit = async (data: SignUpFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await withCaptcha((o) =>
        supabase.auth.signUp({
          email:    data.email,
          password: data.password,
          options: {
            data:            { display_name: data.displayName },
            emailRedirectTo: webRedirectUri,
            ...o,
          },
        })
      );

      if (authError) {
        if (authError.message.toLowerCase().includes("rate limit")) {
          setError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setError(humanize(authError, "auth"));
        }
        return;
      }

      // Supabase returns an empty identities array when the email already exists.
      // In that case do NOT send another verification email — guide the user to sign in.
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        setError("An account with this email already exists. Please sign in or reset your password.");
        return;
      }

      // Store credentials in memory so verify-email can attempt sign-in
      // to detect confirmed status (tempAuth is never persisted to disk).
      tempAuth.store(data.email, data.password);
      router.push({ pathname: "/(auth)/verify-email", params: { email: data.email } });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === "cancelled") return; // silent — user closed browser or account picker
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      // status === "success" → onAuthStateChange fires → _layout guard navigates
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <AuthFormContainer
      title="Create account"
      subtitle="Start tracking your bills and never miss a payment"
    >
      <View className="gap-4">
        {error && (
          <View className="gap-2">
            <AlertBadge message={error} variant="error" />
            {error.includes("already exists") && (
              <View className="flex-row gap-3 px-1">
                <Link href="/(auth)/sign-in" asChild>
                  <Text className="text-caption text-accent font-semibold">Sign in →</Text>
                </Link>
                <Link href="/(auth)/forgot-password" asChild>
                  <Text className="text-caption text-secondary">Forgot password?</Text>
                </Link>
              </View>
            )}
          </View>
        )}



        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              label="Your name"
              placeholder="How should we call you?"
              textContentType="name"
              autoComplete="name"
              autoCapitalize="words"
              returnKeyType="next"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.displayName?.message}
              maxCharacters={50}
            />
          )}
        />

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
            <View className="gap-2">
              <PasswordField
                label="Password"
                placeholder="Minimum 12 characters"
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
                onSubmitEditing={handleSubmit(onSubmit)}
              />
              {/* Password strength bar */}
              {passwordValue.length > 0 && (
                <View className="gap-1">
                  <View className="flex-row gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        className={`flex-1 h-1 rounded-full ${
                          i <= strength ? strengthColor[strength] : "bg-border"
                        }`}
                      />
                    ))}
                  </View>
                  {strength > 0 && (
                    <Text className="text-caption text-secondary">
                      {strengthLabel[strength]}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        />

        <Button
          title="Create account"
          variant="accent"
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          disabled={anyLoading}
          fullWidth
        />

        <View className="flex-row items-center gap-3 my-1">
          <Divider className="flex-1" />
          <Text className="text-caption text-secondary">or</Text>
          <Divider className="flex-1" />
        </View>

        {/* Google OAuth */}
        <Button
          title="Continue with Google"
          variant="secondary"
          icon={<FontAwesome name="google" size={16} color="#EA4335" />}
          onPress={handleGoogle}
          loading={googleLoading}
          disabled={anyLoading}
          fullWidth
        />
      </View>

      {/* Footer */}
      <View className="flex-row justify-center mt-8 gap-1">
        <Text className="text-body text-secondary">Already have an account?</Text>
        <Link href="/(auth)/sign-in" asChild>
          <Text className="text-body text-primary font-semibold">
            Sign in
          </Text>
        </Link>
      </View>
    </AuthFormContainer>
  );
}
