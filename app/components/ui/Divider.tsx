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
        className={`w-px bg-border self-stretch ${className}`}
        style={[{ marginVertical: inset }, style]}
        {...props}
      />
    );
  }

  return (
    <View
      className={`h-px bg-border ${className}`}
      style={[{ marginHorizontal: inset }, style]}
      {...props}
    />
  );
}
