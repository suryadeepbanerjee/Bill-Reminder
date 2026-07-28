import { Pressable, View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  onPress?: () => void;
  padding?: boolean;
}

export function Card({ children, className = "", onPress, padding = true, style, ...props }: CardProps) {
  const base = `bg-surface border border-border rounded-card shadow-resting ${padding ? "p-5" : ""} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={base}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}
        accessibilityRole="button"
        {...(props as object)}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={base} style={style} {...props}>
      {children}
    </View>
  );
}
