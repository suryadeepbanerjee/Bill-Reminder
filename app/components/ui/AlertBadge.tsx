import { View, Text } from "react-native";

interface AlertBadgeProps {
  message: string;
  variant?: "error" | "success" | "warning" | "info";
}

const variantStyles = {
  error: {
    container: "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900",
    text:      "text-red-700 dark:text-red-400",
    dot:       "bg-red-500",
  },
  success: {
    container: "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900",
    text:      "text-emerald-700 dark:text-emerald-400",
    dot:       "bg-emerald-500",
  },
  warning: {
    container: "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900",
    text:      "text-amber-700 dark:text-amber-400",
    dot:       "bg-amber-500",
  },
  info: {
    container: "bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-900",
    text:      "text-sky-700 dark:text-sky-400",
    dot:       "bg-sky-500",
  },
};

export function AlertBadge({ message, variant = "error" }: AlertBadgeProps) {
  const s = variantStyles[variant];
  return (
    <View className={`rounded-input p-3 flex-row items-start gap-2 ${s.container}`}>
      <View className={`w-1.5 h-1.5 rounded-full mt-1.5 ${s.dot}`} />
      <Text
        className={`text-label flex-1 ${s.text}`}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>
    </View>
  );
}
