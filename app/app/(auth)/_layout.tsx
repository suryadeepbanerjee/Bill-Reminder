import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../stores/auth-store";

export default function AuthLayout() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (session) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-in-otp" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
