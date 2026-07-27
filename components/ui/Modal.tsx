import { useEffect } from "react";
import {
  Modal as RNModal,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ModalVariant = "center" | "bottom";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: ModalVariant;
  /** Close when backdrop is pressed (default: true) */
  dismissable?: boolean;
}

export function Modal({
  visible,
  onClose,
  children,
  variant    = "bottom",
  dismissable = true,
}: ModalProps) {
  const insets  = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(600);

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    } else {
      opacity.value    = withTiming(0, { duration: 150 });
      translateY.value = withTiming(600, { duration: 150 });
    }
  }, [visible, opacity, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: variant === "bottom" ? translateY.value : 0 }],
    opacity: variant === "center" ? opacity.value : 1,
  }));

  const handleClose = () => {
    if (!dismissable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={StyleSheet.absoluteFillObject}
      >
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(0,0,0,0.4)" },
              backdropStyle,
            ]}
          />
        </Pressable>

        {/* Sheet */}
        <Animated.View
          style={[
            variant === "bottom"
              ? {
                  position:        "absolute",
                  bottom:           0,
                  left:             0,
                  right:            0,
                  paddingBottom:    insets.bottom,
                  backgroundColor:  "white",
                  borderTopLeftRadius:  20,
                  borderTopRightRadius: 20,
                }
              : {
                  position:     "absolute",
                  top:          "50%",
                  left:         24,
                  right:        24,
                  transform:    [{ translateY: -150 }],
                  borderRadius: 16,
                  backgroundColor: "white",
                },
            sheetStyle,
          ]}
        >
          {/* Handle bar for bottom sheet */}
          {variant === "bottom" && (
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </View>
          )}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
