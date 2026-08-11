import { Stack } from "expo-router";
import { useAppTokens } from "../../../lib/tokens";

// Bills tab uses a headerless Stack so our custom Header component controls the chrome.
export default function BillsLayout() {
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