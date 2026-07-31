import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";

type ChipVariant = "default" | "active" | "category";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  variant?: ChipVariant;
  color?: string; // optional dot color for category chips
}

export function Chip({ label, active = false, onPress, color }: ChipProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const bgClass  = active ? "bg-accent border border-accent" : "bg-surface border border-border";
  const txtClass = active ? "text-accent-text" : "text-primary";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`${bgClass} rounded-pill px-3 py-1.5 flex-row items-center gap-1.5`}
      style={({ pressed }) => ({
        opacity:   pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {color && (
        <Text
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            marginRight: 2,
          }}
        />
      )}
      <Text className={`${txtClass} text-caption font-medium`}>{label}</Text>
    </Pressable>
  );
}
