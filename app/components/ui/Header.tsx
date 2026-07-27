import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "../../lib/theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** When true, adds top safe area padding (for screens without SafeAreaView wrapping) */
  topInset?: boolean;
  /** Transparent header — no background or border */
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  topInset = false,
  transparent = false,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      className={`${transparent ? "" : "bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800"}`}
      style={{ paddingTop: topInset ? insets.top : 0 }}
    >
      <View className="flex-row items-center px-4 h-14">
        {/* Back button */}
        {showBack && (
          <Pressable
            onPress={handleBack}
            className="mr-2 -ml-1 w-10 h-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={Colors.neutral[900]}
              style={{ marginLeft: -2 }}
            />
          </Pressable>
        )}

        {/* Title block */}
        <View className="flex-1">
          {subtitle ? (
            <>
              <Text className="text-caption text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                {subtitle}
              </Text>
              <Text className="text-title text-neutral-900 dark:text-neutral-50" numberOfLines={1}>
                {title}
              </Text>
            </>
          ) : (
            <Text className="text-title text-neutral-900 dark:text-neutral-50" numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>

        {/* Right action */}
        {rightAction && <View className="ml-2">{rightAction}</View>}
      </View>
    </View>
  );
}
