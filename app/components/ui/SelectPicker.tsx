import { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MONTH_NAMES } from "@shared/schemas/../";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption<T> {
  label: string;
  value: T;
}

interface SelectPickerProps<T> {
  label?:       string;
  placeholder?: string;
  value:        T | null | undefined;
  options:      SelectOption<T>[];
  onChange:     (value: T) => void;
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
}

// ── Generic SelectPicker ──────────────────────────────────────────────────────
// Renders as a pressable field (same style as TextInput); tapping opens
// a bottom-sheet Modal with the available options.

export function SelectPicker<T extends string | number>({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  error,
  hint,
  disabled = false,
}: SelectPickerProps<T>) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const hasError   = Boolean(error);
  const borderClass = hasError ? "border-error" : "border-border";

  const handleSelect = useCallback(
    (v: T) => {
      onChange(v);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <>
      <View className="mb-4 w-full">
        {label ? (
          <Text className="text-label text-primary font-medium mb-2">{label}</Text>
        ) : null}

        <Pressable
          onPress={() => !disabled && setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          className={`flex-row items-center justify-between bg-input border ${borderClass} rounded-input px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}
          style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.75 : undefined })}
        >
          <Text
            className={`text-body flex-1 ${
              selectedLabel ? "text-primary" : "text-secondary"
            }`}
          >
            {selectedLabel ?? placeholder}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            className="text-secondary ml-2"
          />
        </Pressable>

        {hasError ? (
          <Text
            className="text-caption text-error mt-2 font-medium"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : hint ? (
          <Text className="text-caption text-secondary mt-2">{hint}</Text>
        ) : null}
      </View>

      {/* Bottom-sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setOpen(false)}
          accessibilityLabel="Close picker"
        />

        <View className="bg-canvas rounded-t-2xl pb-10 max-h-[60%]">
          {/* Handle + header */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-border" />
          </View>

          {label ? (
            <View className="px-4 pb-3 border-b border-border">
              <Text className="text-label font-semibold text-primary">{label}</Text>
            </View>
          ) : null}

          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.value)}
                  className={`flex-row items-center justify-between px-4 py-3.5 border-b border-border/50 ${
                    isSelected ? "bg-accent/10" : ""
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    className={`text-body ${
                      isSelected ? "text-accent font-semibold" : "text-primary"
                    }`}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} className="text-accent" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

// ── Month-specific preset ─────────────────────────────────────────────────────

const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  label: name,
  value: i + 1,  // 1–12
}));

interface MonthPickerProps {
  label?:   string;
  value:    number | null | undefined; // 1–12
  onChange: (month: number) => void;
  error?:   string;
  hint?:    string;
}

export function MonthPicker({ label = "Month", value, onChange, error, hint }: MonthPickerProps) {
  return (
    <SelectPicker<number>
      label={label}
      placeholder="Select month…"
      value={value}
      options={MONTH_OPTIONS}
      onChange={onChange}
      error={error}
      hint={hint}
    />
  );
}
