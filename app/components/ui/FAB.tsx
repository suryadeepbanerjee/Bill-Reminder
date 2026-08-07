import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Shadow, Colors } from "../../lib/theme";

interface FABProps {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

import { useHouseholdStore } from "../../stores/household-store";

export function FAB({ onPress, label = "Add Bill", accessibilityLabel = "Add new bill" }: FABProps) {
  const role = useHouseholdStore(s => s.activeHousehold?.member.role);

  const handlePress = () => {
    if (role === "member") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      import("react-native").then(({ Alert }) => {
        Alert.alert("Permission Denied", "You are a member of this group, you cannot perform this action.");
      });
      return;
    }
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
      className="bg-accent rounded-pill flex-row items-center justify-center px-5 h-14 gap-2"
    >
      <Ionicons name="add" size={22} className="text-accent-text" />
      {label ? (
        <Text className="text-label text-accent-text font-bold">{label}</Text>
      ) : null}
    </Pressable>
  );
}
