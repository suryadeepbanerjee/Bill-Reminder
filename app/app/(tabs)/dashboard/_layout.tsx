import { Stack } from "expo-router";
import { useAppTokens } from "../../../lib/tokens";

export default function DashboardLayout() {
  const tokens = useAppTokens();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.canvas },
      }}
    />
  );
}