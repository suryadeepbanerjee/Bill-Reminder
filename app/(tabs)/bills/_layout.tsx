import { Stack } from "expo-router";

// Bills tab uses a headerless Stack so our custom Header component controls the chrome.
export default function BillsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
