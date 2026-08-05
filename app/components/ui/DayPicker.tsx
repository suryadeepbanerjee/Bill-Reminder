import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";

const MAX_DAYS = 31;
const COLUMNS = 7;
const GAP = 8;

interface DayPickerProps {
	label?: string;
	value: number | null | undefined;
	onChange: (day: number) => void;
	/** Max valid day for the selected month (28-31). Defaults to 31. */
	maxDay?: number;
	error?: string;
}

export function DayPicker({ label = "Day", value, onChange, maxDay = MAX_DAYS, error }: DayPickerProps) {
	const [text, setText] = useState(value != null ? String(value) : "");

	useEffect(() => {
		setText(value != null ? String(value) : "");
	}, [value]);

	const days = Array.from({ length: maxDay }, (_, i) => i + 1);

	// Percentage-based basis so the grid always fits exactly COLUMNS-per-row
	// regardless of screen width — fixed px cells overflow on narrow phones.
	const cellBasis = `${100 / COLUMNS}%`;

	return (
		<View className="mb-4">
			<Text className="text-label text-primary font-medium mb-3">{label}</Text>
			<View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: GAP }}>
				{days.map((d) => {
					const isSelected = value === d;
					return (
						<View key={d} style={{ flexBasis: cellBasis, alignItems: "center" }}>
							<Pressable
								onPress={() => onChange(d)}
								className={`w-11 h-11 rounded-input items-center justify-center border ${
									isSelected ? "border-accent bg-accent" : "border-border bg-surface"
								}`}
								style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
								accessibilityRole="radio"
								accessibilityLabel={`Day ${d}`}
								accessibilityState={{ selected: isSelected }}
							>
								<Text
									className={`text-base font-medium ${isSelected ? "text-white" : "text-primary"}`}
									style={{ fontVariant: ["tabular-nums"] }}
									numberOfLines={1}
								>
									{d}
								</Text>
							</Pressable>
						</View>
					);
				})}
			</View>
			{error && (
				<Text className="text-caption text-error mt-1.5 font-medium" accessibilityRole="alert">
					{error}
				</Text>
			)}
		</View>
	);
}

/** Returns max valid day for a given month (handles leap years). */
export function getMaxDayForMonth(month: number, year?: number): number {
	if (!month) return 31;
	const y = year ?? new Date().getFullYear();
	return new Date(y, month, 0).getDate();
}
