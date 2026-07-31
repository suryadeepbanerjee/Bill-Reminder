import { Pressable, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Colors } from "../../lib/theme";

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const TRACK_WIDTH  = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE   = 22;
const THUMB_MARGIN = 3;

export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = "Toggle",
}: SwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 150 });
  }, [value, progress]);

  const handlePress = () => {
    if (disabled) return;
    const newValue = !value;
    progress.value = withTiming(newValue ? 1 : 0, { duration: 150 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    ) > 0.5
      ? "#D1A920"
      : Colors.neutral[300],
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(
        progress.value,
        [0, 1],
        [THUMB_MARGIN, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN],
        Extrapolation.CLAMP
      ),
    }],
  }));

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={{ opacity: disabled ? 0.4 : 1 }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            width:        TRACK_WIDTH,
            height:       TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            justifyContent: "center",
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width:        THUMB_SIZE,
              height:       THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: Colors.white,
              shadowColor:     "#000",
              shadowOffset:    { width: 0, height: 1 },
              shadowOpacity:   0.15,
              shadowRadius:    2,
              elevation:       2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
