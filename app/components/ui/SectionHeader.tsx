import { View, Text, Pressable } from "react-native";

interface SectionHeaderProps {
  title: string;
  /** Optional right-side action */
  action?: { label: string; onPress: () => void };
}

/**
 * Section label — intentionally simple, no uppercase, no wide tracking.
 * Communicates grouping through weight and size contrast alone.
 */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <Text className="text-caption text-secondary font-medium">
        {title}
      </Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text className="text-caption text-accent font-medium">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
