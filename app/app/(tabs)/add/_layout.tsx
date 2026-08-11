import { Stack } from "expo-router";
import { useAppTokens } from "../../../lib/tokens";

export default function AddLayout() {
  const tokens = useAppTokens();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: tokens.canvas },
        headerShadowVisible: false,
        headerTintColor: tokens.primary,
        headerTitleStyle: {
          fontSize: 22,
          fontWeight: "600",
          color: tokens.primary,
        },
        // Paint the native screen container with the theme canvas so pushed
        // screens slide in dark/light instead of the native default (white).
        contentStyle: { backgroundColor: tokens.canvas },
      }}
    />
  );
}