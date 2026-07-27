import { forwardRef } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextInput } from "./TextInput";
import type { TextInput as RNTextInput, TextInputProps as RNTextInputProps } from "react-native";
import { Colors } from "../../lib/theme";

interface SearchFieldProps extends Omit<RNTextInputProps, "label"> {
  placeholder?: string;
  onClear?: () => void;
}

export const SearchField = forwardRef<RNTextInput, SearchFieldProps>(
  ({ placeholder = "Search…", onClear, value, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        label=""
        placeholder={placeholder}
        value={value}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        leadingIcon={
          <Ionicons name="search-outline" size={18} color={Colors.neutral[400]} />
        }
        trailingElement={
          value && String(value).length > 0 ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <View className="bg-neutral-300 dark:bg-neutral-600 rounded-full w-4 h-4 items-center justify-center">
                <Ionicons name="close" size={10} color={Colors.neutral[700]} />
              </View>
            </Pressable>
          ) : null
        }
        {...props}
      />
    );
  }
);

SearchField.displayName = "SearchField";
