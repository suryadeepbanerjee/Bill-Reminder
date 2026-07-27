import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Shadow, Colors } from "../../lib/theme";

interface FABProps {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

export function FAB({ onPress, label = "Add Bill", accessibilityLabel = "Add new bill" }: FABProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        opacity:    pressed ? 0.88 : 1,
        transform:  [{ scale: pressed ? 0.95 : 1 }],
        ...Shadow.fab,
      })}
      className="bg-accent-500 rounded-pill flex-row items-center justify-center px-5 h-14 gap-2"
    >
      <Ionicons name="add" size={22} color={Colors.white} />
      {label ? (
        <Text className="text-label text-white font-semibold">{label}</Text>
      ) : null}
    </Pressable>
  );
}
