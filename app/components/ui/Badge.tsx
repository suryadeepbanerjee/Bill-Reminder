import { Text, View } from "react-native";

type BadgeVariant = "default" | "accent" | "overdue" | "paid" | "upcoming" | "error";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** Count badge mode — shows a number, auto-clips at 99+ */
  count?: number;
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string }> = {
  default:  { bg: "bg-neutral-100 dark:bg-neutral-800",  text: "text-neutral-700 dark:text-neutral-300" },
  accent:   { bg: "bg-accent-100 dark:bg-accent-950",    text: "text-accent-700 dark:text-accent-300" },
  overdue:  { bg: "bg-amber-100 dark:bg-amber-950",      text: "text-amber-700 dark:text-amber-400" },
  paid:     { bg: "bg-emerald-100 dark:bg-emerald-950",  text: "text-emerald-700 dark:text-emerald-400" },
  upcoming: { bg: "bg-sky-100 dark:bg-sky-950",          text: "text-sky-700 dark:text-sky-400" },
  error:    { bg: "bg-red-100 dark:bg-red-950",          text: "text-red-700 dark:text-red-400" },
};

export function Badge({ label, variant = "default", size = "md", count }: BadgeProps) {
  const v = variantClasses[variant];
  const displayLabel = count !== undefined
    ? count > 99 ? "99+" : String(count)
    : label;

  const sizeClass = size === "sm"
    ? "px-1.5 py-0.5 rounded-sm"
    : "px-2 py-1 rounded-sm";

  const textClass = size === "sm" ? "text-caption" : "text-caption";

  return (
    <View className={`${v.bg} ${sizeClass} self-start`}>
      <Text className={`${v.text} ${textClass} font-medium`}>{displayLabel}</Text>
    </View>
  );
}
