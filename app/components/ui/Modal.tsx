import { useEffect, useState } from "react";
import {
  Modal as RNModal,
  View,
  Pressable,
  Keyboard,
  Platform,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      opacity.value    = withTiming(0, { duration: 150 });
      translateY.value = withTiming(600, { duration: 150 });
      setKeyboardHeight(0);
    } else {
      opacity.value    = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  useEffect(() => {
    if (!visible || variant !== "bottom") return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible, variant]);

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

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
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
        className="bg-surface"
        style={[
          variant === "bottom"
            ? {
                position:        "absolute",
                bottom:           keyboardHeight > 0 ? keyboardHeight : 0,
                left:             0,
                right:            0,
                maxHeight:        "85%",
                paddingBottom:    bottomInset,
                borderTopLeftRadius:  20,
                borderTopRightRadius: 20,
              }
            : {
                position:     "absolute",
                top:          "50%",
                left:         24,
                right:        24,
                transform:    [{ translateY: -150 }],
                borderRadius: 20,
              },
          sheetStyle,
        ]}
      >
        {/* Handle bar for bottom sheet */}
        {variant === "bottom" && (
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-border" />
          </View>
        )}
        {children}
      </Animated.View>
    </RNModal>
  );
}
