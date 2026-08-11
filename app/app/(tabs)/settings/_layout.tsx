import { Stack } from "expo-router";
import { useAppTokens } from "../../../lib/tokens";

export default function SettingsLayout() {
  const tokens = useAppTokens();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Paint the native screen container with the theme canvas so pushed
        // screens (members, profile) slide in dark/light instead of flashing
        // the native default (white) background.
        contentStyle: { backgroundColor: tokens.canvas },
      }}
    />
  );
}