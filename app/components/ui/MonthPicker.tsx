import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const MONTHS = [
  { value: 1,  label: "January",   short: "Jan" },
  { value: 2,  label: "February",  short: "Feb" },
  { value: 3,  label: "March",     short: "Mar" },
  { value: 4,  label: "April",     short: "Apr" },
  { value: 5,  label: "May",       short: "May" },
  { value: 6,  label: "June",      short: "Jun" },
  { value: 7,  label: "July",      short: "Jul" },
  { value: 8,  label: "August",    short: "Aug" },
  { value: 9,  label: "September", short: "Sep" },
  { value: 10, label: "October",   short: "Oct" },
  { value: 11, label: "November",  short: "Nov" },
  { value: 12, label: "December",  short: "Dec" },
];

interface MonthPickerProps {
  label?: string;
  value: number | null | undefined;
  onChange: (month: number) => void;
  error?: string;
}

export function MonthPicker({ label = "Month", value, onChange, error }: MonthPickerProps) {
  const selected = MONTHS.find((m) => m.value === value);

  return (
    <View className="mb-4">
      <Text className="text-label text-primary font-medium mb-3">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {MONTHS.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            className={`rounded-input px-3 py-2.5 border ${
              value === m.value
                ? "border-accent bg-accent/10"
                : "border-border bg-surface"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, minWidth: 72, alignItems: "center" })}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: value === m.value }}
          >
            <Text
              className={`text-caption font-medium ${
                value === m.value ? "text-accent" : "text-primary"
              }`}
            >
              {m.short}
            </Text>
          </Pressable>
        ))}
      </View>
      {error && (
        <Text className="text-caption text-error mt-1.5 font-medium" accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

export function getMonthName(month: number): string {
  return MONTHS.find((m) => m.value === month)?.label ?? "";
}
