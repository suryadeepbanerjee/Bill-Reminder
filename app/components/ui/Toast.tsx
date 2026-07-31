import { useEffect, useRef } from "react";
import { Animated, Text, View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../lib/theme";

export type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  /** Duration in ms before auto-dismiss (default: 3000) */
  duration?: number;
}

const variantConfig: Record<ToastVariant, {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
}> = {
  success: {
    icon:      "checkmark-circle",
    iconColor: Colors.emerald[500],
    bg:        "rgba(30,30,30,0.95)",
  },
  error: {
    icon:      "alert-circle",
    iconColor: Colors.red[400],
    bg:        "rgba(30,30,30,0.95)",
  },
  info: {
    icon:      "information-circle",
    iconColor: Colors.sky[400],
    bg:        "rgba(30,30,30,0.95)",
  },
};

export function Toast({
  visible,
  message,
  variant   = "info",
  onDismiss,
  duration  = 3000,
}: ToastProps) {
  const insets    = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const config = variantConfig[variant];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0,   duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1,   duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        hide();
      }, duration);
      return () => clearTimeout(timer);
    } else {
      hide();
    }
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 150, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 150, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { justifyContent: "flex-start", alignItems: "center", paddingTop: insets.top + 8, pointerEvents: "none" },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable
        onPress={hide}
        style={{
          backgroundColor: config.bg,
          borderRadius:    12,
          paddingHorizontal: 16,
          paddingVertical:   12,
          flexDirection:     "row",
          alignItems:        "center",
          gap:               10,
          maxWidth:          340,
          shadowColor:       "#000",
          shadowOffset:      { width: 0, height: 4 },
          shadowOpacity:     0.2,
          shadowRadius:      12,
          elevation:         8,
        }}
      >
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: "500", flex: 1 }}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
