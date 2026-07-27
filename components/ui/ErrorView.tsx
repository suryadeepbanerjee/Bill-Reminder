import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { Colors } from "../../lib/theme";

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorView({
  message    = "Something went wrong. Please try again.",
  onRetry,
  retryLabel = "Try again",
}: ErrorViewProps) {
  return (
    <View className="items-center justify-center py-12 px-8 gap-4">
      <View className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950 items-center justify-center">
        <Ionicons name="alert-circle-outline" size={28} color={Colors.red[600]} />
      </View>
      <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold text-center">
        Something went wrong
      </Text>
      <Text className="text-body text-neutral-500 dark:text-neutral-400 text-center">
        {message}
      </Text>
      {onRetry && (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="secondary"
          size="sm"
        />
      )}
    </View>
  );
}
