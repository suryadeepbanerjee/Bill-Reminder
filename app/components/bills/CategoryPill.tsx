import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveIcon } from "../../lib/utils";
import { Colors } from "../../lib/theme";

interface CategoryPillProps {
  name:  string;
  icon:  string;   // Lucide icon key from DB
  color: string;   // hex color from DB
  size?: "sm" | "md";
}

import { useColorScheme } from "nativewind";

export function CategoryPill({ name, icon, color, size = "md" }: CategoryPillProps) {
  const ionIcon = resolveIcon(icon) as keyof typeof Ionicons.glyphMap;
  const iconSize = size === "sm" ? 12 : 14;
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#FFFFFF" : "#171717";

  return (
    <View
      className={`flex-row items-center gap-1 rounded-pill self-start bg-neutral-100 dark:bg-neutral-800 ${
        size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1"
      }`}
    >
      <Ionicons name={ionIcon} size={iconSize} color={iconColor} />
      <Text
        className={`font-medium text-primary ${size === "sm" ? "text-caption" : "text-caption"}`}
      >
        {name}
      </Text>
    </View>
  );
}

/** Just the icon badge (for use inside BillCard) */
interface CategoryIconBadgeProps {
  icon:  string;
  color: string;
  size?: number;
}

export function CategoryIconBadge({ icon, color, size = 40 }: CategoryIconBadgeProps) {
  const ionIcon = resolveIcon(icon) as keyof typeof Ionicons.glyphMap;
  const iconSize = Math.round(size * 0.45);
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#FFFFFF" : "#171717";

  return (
    <View
      className="items-center justify-center rounded-input bg-neutral-100 dark:bg-neutral-800"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width:           size,
        height:          size,
      }}
    >
      <Ionicons name={ionIcon} size={iconSize} color={iconColor} />
    </View>
  );
}
