import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!", headerShown: true }} />
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 items-center justify-center p-5">
          <Text className="text-xl font-bold text-primary">
            This screen doesn't exist.
          </Text>
          <Link href="/" className="mt-4 p-4">
            <Text className="text-blue-500 font-semibold">Go to home screen!</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
