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

export function CategoryPill({ name, icon, color, size = "md" }: CategoryPillProps) {
  const ionIcon = resolveIcon(icon) as keyof typeof Ionicons.glyphMap;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <View
      className={`flex-row items-center gap-1 rounded-pill self-start ${
        size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1"
      }`}
      style={{ backgroundColor: color + "18" }} // 10% opacity tint from category color
    >
      <Ionicons name={ionIcon} size={iconSize} color={color} />
      <Text
        className={`font-medium ${size === "sm" ? "text-caption" : "text-caption"}`}
        style={{ color }}
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

  return (
    <View
      className="items-center justify-center rounded-input"
      style={{
        width:           size,
        height:          size,
        backgroundColor: color + "18",
      }}
    >
      <Ionicons name={ionIcon} size={iconSize} color={color} />
    </View>
  );
}
