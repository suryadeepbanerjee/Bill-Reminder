import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
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
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? Colors.neutral[100] : Colors.neutral[900];

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
      className={`${transparent ? "" : "bg-canvas border-b border-border"}`}
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
              className="text-primary"
              style={{ marginLeft: -2 }}
            />
          </Pressable>
        )}

        {/* Title block */}
        <View className="flex-1">
          {subtitle ? (
            <>
              <Text className="text-caption text-secondary uppercase tracking-wider">
                {subtitle}
              </Text>
              <Text className="text-title text-primary" numberOfLines={1}>
                {title}
              </Text>
            </>
          ) : (
            <Text className="text-title text-primary" numberOfLines={1}>
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
