import { View, Text, Pressable } from "react-native";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = 2027;

interface YearPickerProps {
  label?: string;
  value: number | null | undefined;
  onChange: (year: number) => void;
  min?: number;
  max?: number;
  error?: string;
}

export function YearPicker({
  label = "Year",
  value,
  onChange,
  min = MIN_YEAR,
  max = MAX_YEAR,
  error,
}: YearPickerProps) {
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View className="mb-4">
      <Text className="text-label text-primary font-medium mb-3">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {years.map((y) => (
          <Pressable
            key={y}
            onPress={() => onChange(y)}
            className={`rounded-input px-3 py-2.5 border ${
              value === y
                ? "border-accent bg-accent/10"
                : "border-border bg-surface"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, minWidth: 64, alignItems: "center" })}
            accessibilityRole="radio"
            accessibilityLabel={`Year ${y}`}
            accessibilityState={{ selected: value === y }}
          >
            <Text
              className={`text-caption font-medium ${
                value === y ? "text-accent" : "text-primary"
              }`}
            >
              {y}
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
