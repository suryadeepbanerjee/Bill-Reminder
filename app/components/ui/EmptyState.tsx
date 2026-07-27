import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { Colors } from "../../lib/theme";

type EmptyStateVariant = "bills" | "search" | "generic" | "paid" | "overdue";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const variantDefaults: Record<EmptyStateVariant, {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}> = {
  bills: {
    icon:     "receipt-outline",
    title:    "No bills yet",
    subtitle: "Add your first recurring bill to get started tracking payments.",
  },
  search: {
    icon:     "search-outline",
    title:    "No results",
    subtitle: "Try a different search term or remove some filters.",
  },
  generic: {
    icon:     "layers-outline",
    title:    "Nothing here",
    subtitle: "Check back later.",
  },
  paid: {
    icon:     "checkmark-circle-outline",
    title:    "No recent payments",
    subtitle: "Payments you mark as paid will appear here.",
  },
  overdue: {
    icon:     "time-outline",
    title:    "All caught up",
    subtitle: "You have no overdue bills. Great work!",
  },
};

export function EmptyState({
  variant  = "generic",
  title,
  subtitle,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const defaults = variantDefaults[variant];
  const displayTitle    = title    ?? defaults.title;
  const displaySubtitle = subtitle ?? defaults.subtitle;

  return (
    <View className="items-center justify-center py-12 px-8">
      <View className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center mb-4">
        <Ionicons
          name={defaults.icon}
          size={28}
          color={Colors.neutral[400]}
        />
      </View>
      <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold text-center mb-2">
        {displayTitle}
      </Text>
      <Text className="text-body text-neutral-500 dark:text-neutral-400 text-center leading-6">
        {displaySubtitle}
      </Text>
      {ctaLabel && onCta && (
        <View className="mt-6">
          <Button title={ctaLabel} onPress={onCta} variant="accent" size="md" />
        </View>
      )}
    </View>
  );
}
