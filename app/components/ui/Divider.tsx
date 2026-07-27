import { View, ViewProps } from "react-native";

interface DividerProps extends ViewProps {
  orientation?: "horizontal" | "vertical";
  inset?: number;
}

export function Divider({
  orientation = "horizontal",
  inset = 0,
  className = "",
  style,
  ...props
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <View
        className={`w-px bg-neutral-200 dark:bg-neutral-800 self-stretch ${className}`}
        style={[{ marginVertical: inset }, style]}
        {...props}
      />
    );
  }

  return (
    <View
      className={`h-px bg-neutral-200 dark:bg-neutral-800 ${className}`}
      style={[{ marginHorizontal: inset }, style]}
      {...props}
    />
  );
}
