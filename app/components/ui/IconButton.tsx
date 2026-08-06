import { Pressable, PressableProps, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "../../lib/theme";
import { tryAcquireAction, releaseAction } from "@shared/utils/action-guard";

type IconButtonVariant = "default" | "ghost" | "filled" | "danger";
type IconButtonSize    = "sm" | "md" | "lg";

interface IconButtonProps extends Omit<PressableProps, "style"> {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  rounded?: boolean;
  accessibilityLabel: string;
  /**
   * Optional silent per-action dedupe key. When set, rapid repeat presses of
   * the same key no-op (no visual change) — only the underlying action is
   * deduped.
   */
  guardKey?: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: "bg-neutral-100 dark:bg-neutral-800",
  ghost:   "bg-transparent",
  filled:  "bg-accent",
  danger:  "bg-red-50 dark:bg-red-950",
};

const sizeMap: Record<IconButtonSize, { container: number; inner: number }> = {
  sm: { container: 32, inner: 16 },
  md: { container: 40, inner: 20 },
  lg: { container: 48, inner: 24 },
};

export function IconButton({
  icon,
  variant  = "ghost",
  size     = "md",
  rounded  = false,
  onPress,
  accessibilityLabel,
  disabled,
  guardKey,
  ...props
}: IconButtonProps) {
  const dim = sizeMap[size];
  const radiusClass = rounded ? "rounded-full" : "rounded-card";

  const handlePress = (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`${variantClasses[variant]} ${radiusClass} items-center justify-center`}
      style={({ pressed }) => ({
        width:   dim.container,
        height:  dim.container,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
      {...props}
    >
      {icon}
    </Pressable>
  );
}
