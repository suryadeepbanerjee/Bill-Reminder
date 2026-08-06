import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../stores/auth-store";

export default function AuthLayout() {
  const { session, isLoading } = useAuthStore();

  // Use router.replace() inside useEffect rather than <Redirect>.
  // <Redirect> uses useFocusEffect which calls useNavigation() from @react-navigation/native
  // — that hook throws "no navigation context" when the layout returns null (during loading)
  // because the parent layout hasn't yet mounted its own navigator.
  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isLoading, session]);

  // While loading or redirecting, render nothing (loading overlay from root layout covers this)
  if (isLoading || session) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-in-otp" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="update-password" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
