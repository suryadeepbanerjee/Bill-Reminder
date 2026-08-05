import { Pressable, Text, ActivityIndicator, PressableProps, View } from "react-native";
import * as Haptics from "expo-haptics";
import { tryAcquireAction, releaseAction } from "../../lib/action-guard";

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
  /**
   * Optional silent per-action dedupe key. When set, rapid repeat presses of
   * the same key no-op (no visual change) — only the underlying action is
   * deduped. Share the same key across entry points that trigger the SAME
   * action; use distinct keys for distinct actions.
   */
  guardKey?: string;
}

const variants: Record<ButtonVariant, { container: string; text: string; indicator: string }> = {
  primary: {
    container: "bg-primary rounded-input items-center justify-center flex-row shadow-resting",
    text:      "text-canvas font-semibold",
    indicator: "var(--color-canvas)",
  },
  accent: {
    container: "bg-accent rounded-input items-center justify-center flex-row shadow-fab",
    text:      "text-accent-text font-semibold",
    indicator: "var(--color-accent-text)",
  },
  secondary: {
    container: "bg-surface border border-border rounded-input items-center justify-center flex-row shadow-resting",
    text:      "text-primary font-medium",
    indicator: "var(--color-primary)",
  },
  ghost: {
    container: "bg-transparent items-center justify-center flex-row",
    text:      "text-secondary font-medium",
    indicator: "var(--color-secondary)",
  },
  destructive: {
    container: "bg-error/10 border border-error/20 rounded-input items-center justify-center flex-row",
    text:      "text-error font-medium",
    indicator: "var(--color-error)",
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
  guardKey,
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

    if (!guardKey) {
      onPress?.(e);
      return;
    }

    if (!tryAcquireAction(guardKey)) return;
    const result = onPress?.(e);
    if (result && typeof (result as any).then === "function") {
      (result as Promise<unknown>).catch(() => {}).finally(() => releaseAction(guardKey));
    } else {
      releaseAction(guardKey);
    }
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
