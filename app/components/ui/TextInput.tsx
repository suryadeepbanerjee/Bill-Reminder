import { forwardRef, useState } from "react";
import {
  TextInput as RNTextInput,
  Text,
  View,
  TextInputProps as RNTextInputProps,
} from "react-native";
import { Colors } from "../../lib/theme";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
  trailingElement?: React.ReactNode;
  maxCharacters?: number;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  (
    {
      label,
      error,
      hint,
      leadingIcon,
      trailingElement,
      maxCharacters,
      onFocus,
      onBlur,
      value,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasError = Boolean(error);

    const borderClass = hasError
      ? "border-red-600"
      : isFocused
      ? "border-accent-500"
      : "border-neutral-200 dark:border-neutral-700";

    const bgClass = "bg-white dark:bg-neutral-900";

    return (
      <View>
        {/* Label row */}
        {label ? (
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-label text-neutral-700 dark:text-neutral-300 font-medium">
              {label}
            </Text>
            {maxCharacters && value !== undefined && (
              <Text className="text-caption text-neutral-400">
                {String(value).length}/{maxCharacters}
              </Text>
            )}
          </View>
        ) : null}

        {/* Input container */}
        <View
          className={`flex-row items-center ${bgClass} border ${borderClass} rounded-input overflow-hidden`}
        >
          {leadingIcon && (
            <View className="pl-3 pr-1">{leadingIcon}</View>
          )}
          <RNTextInput
            ref={ref}
            className="flex-1 px-4 py-3 text-body text-neutral-900 dark:text-neutral-50"
            placeholderTextColor={Colors.neutral[400]}
            accessibilityLabel={label}
            value={value}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            maxLength={maxCharacters}
            {...props}
          />
          {trailingElement && (
            <View className="pr-3 pl-1">{trailingElement}</View>
          )}
        </View>

        {/* Error / hint row */}
        {hasError ? (
          <Text className="text-caption text-red-600 mt-1" accessibilityRole="alert">
            {error}
          </Text>
        ) : hint ? (
          <Text className="text-caption text-neutral-400 mt-1">{hint}</Text>
        ) : null}
      </View>
    );
  }
);

TextInput.displayName = "TextInput";
