import { Pressable, Text, ActivityIndicator, PressableProps, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "../../lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "accent";
type ButtonSize    = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, { container: string; text: string; indicator: string }> = {
  primary: {
    container: "bg-neutral-900 dark:bg-neutral-100 rounded-input items-center justify-center flex-row",
    text:      "text-white dark:text-neutral-900 font-semibold",
    indicator: Colors.white,
  },
  accent: {
    container: "bg-accent-500 rounded-input items-center justify-center flex-row",
    text:      "text-white font-semibold",
    indicator: Colors.white,
  },
  secondary: {
    container: "bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-input items-center justify-center flex-row",
    text:      "text-neutral-700 dark:text-neutral-200 font-medium",
    indicator: Colors.neutral[700],
  },
  ghost: {
    container: "items-center justify-center flex-row",
    text:      "text-neutral-600 dark:text-neutral-400 font-medium",
    indicator: Colors.neutral[600],
  },
  destructive: {
    container: "bg-red-600 rounded-input items-center justify-center flex-row",
    text:      "text-white font-semibold",
    indicator: Colors.white,
  },
};

const sizes: Record<ButtonSize, { container: string; text: string; gap: string }> = {
  sm: { container: "py-2 px-4 gap-1.5", text: "text-label", gap: "gap-1.5" },
  md: { container: "py-3 px-5 gap-2",   text: "text-label", gap: "gap-2" },
  lg: { container: "py-4 px-6 gap-2",   text: "text-body",  gap: "gap-2" },
};

export function Button({
  title,
  variant    = "primary",
  size       = "md",
  loading    = false,
  disabled,
  icon,
  iconPosition = "left",
  fullWidth  = false,
  onPress,
  ...props
}: ButtonProps) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;

  const handlePress = (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
    if (isDisabled) return;
    if (variant === "destructive") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (variant !== "ghost") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      className={`${v.container} ${s.container} ${fullWidth ? "w-full" : ""}`}
      style={({ pressed }) => ({
        opacity: isDisabled ? 0.45 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.indicator} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <View className="mr-1.5">{icon}</View>
          )}
          <Text className={`${v.text} ${s.text}`}>{title}</Text>
          {icon && iconPosition === "right" && (
            <View className="ml-1.5">{icon}</View>
          )}
        </>
      )}
    </Pressable>
  );
}
