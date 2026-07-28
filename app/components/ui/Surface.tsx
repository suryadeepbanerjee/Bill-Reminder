import { View, ViewProps } from "react-native";

type SurfaceLevel = "resting" | "raised";

interface SurfaceProps extends ViewProps {
  level?: SurfaceLevel;
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
  const borderClass =
    bordered && level === "resting"
      ? "border border-border"
      : "";

  const shadowClass = level === "raised" ? "shadow-raised" : "shadow-resting";

  const roundedClass =
    rounded === "card"  ? "rounded-card"  :
    rounded === "sheet" ? "rounded-sheet" :
    rounded === "sm"    ? "rounded-sm"    : "";

  return (
    <View
      className={`bg-surface ${borderClass} ${roundedClass} ${shadowClass} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}
