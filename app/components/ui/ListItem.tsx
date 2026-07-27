import { Pressable, View, Text } from "react-native";
import { Divider } from "./Divider";
import * as Haptics from "expo-haptics";

interface ListItemProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  showDivider = false,
  destructive = false,
  disabled    = false,
}: ListItemProps) {
  const titleClass = destructive
    ? "text-red-600 dark:text-red-400"
    : "text-body text-neutral-900 dark:text-neutral-100";

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const inner = (
    <View className="flex-row items-center gap-3 px-4 py-3">
      {leading && <View>{leading}</View>}
      <View className="flex-1">
        <Text className={`${titleClass} font-medium`} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-caption text-neutral-500 dark:text-neutral-400 mt-0.5">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && <View>{trailing}</View>}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={({ pressed }) => ({
            opacity:         disabled ? 0.4 : pressed ? 0.7 : 1,
            backgroundColor: pressed ? "rgba(0,0,0,0.03)" : "transparent",
          })}
        >
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {showDivider && <Divider inset={16} />}
    </View>
  );
}
