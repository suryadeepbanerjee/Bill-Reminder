import { View, ViewProps } from "react-native";
import { Shadow } from "../../lib/theme";

type SurfaceLevel = "resting" | "raised";

interface SurfaceProps extends ViewProps {
  level?: SurfaceLevel;
  /** Use border instead of shadow for resting level (default: true for resting) */
  bordered?: boolean;
  rounded?: "card" | "sheet" | "sm" | "none";
  className?: string;
}

export function Surface({
  children,
  level = "resting",
  bordered = true,
  rounded = "card",
  className = "",
  style,
  ...props
}: SurfaceProps) {
  const shadow = level === "raised" ? Shadow.raised : undefined;

  const borderClass =
    bordered && level === "resting"
      ? "border border-neutral-200 dark:border-neutral-800"
      : "";

  const roundedClass =
    rounded === "card"  ? "rounded-card"  :
    rounded === "sheet" ? "rounded-sheet" :
    rounded === "sm"    ? "rounded-sm"    : "";

  return (
    <View
      className={`bg-white dark:bg-neutral-900 ${borderClass} ${roundedClass} ${className}`}
      style={[shadow, style]}
      {...props}
    >
      {children}
    </View>
  );
}
