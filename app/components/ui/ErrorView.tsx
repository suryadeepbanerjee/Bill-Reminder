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
      <View className="w-14 h-14 rounded-full bg-error/10 items-center justify-center">
        <Ionicons name="alert-circle-outline" size={28} className="text-error" />
      </View>
      <Text className="text-label text-primary font-semibold text-center">
        Something went wrong
      </Text>
      <Text className="text-body text-secondary text-center">
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
