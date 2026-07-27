import { Stack } from "expo-router";
import { Colors } from "../../../lib/theme";

export default function AddLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.neutral[50] },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontSize: 22,
          fontWeight: "600",
          color: Colors.neutral[900],
        },
      }}
    />
  );
}
