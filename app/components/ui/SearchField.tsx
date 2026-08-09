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
        maxLength={120}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        leadingIcon={
          <Ionicons name="search-outline" size={18} className="text-primary" />
        }
        trailingElement={
          value && String(value).length > 0 ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <View className="bg-border rounded-full w-4 h-4 items-center justify-center">
                <Ionicons name="close" size={10} className="text-primary" />
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
