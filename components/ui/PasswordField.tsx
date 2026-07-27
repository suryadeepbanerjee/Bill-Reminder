import { forwardRef, useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextInput } from "./TextInput";
import type { TextInput as RNTextInput, TextInputProps as RNTextInputProps } from "react-native";
import { Colors } from "../../lib/theme";

interface PasswordFieldProps extends Omit<RNTextInputProps, "secureTextEntry"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const PasswordField = forwardRef<RNTextInput, PasswordFieldProps>(
  ({ label = "Password", error, hint, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <TextInput
        ref={ref}
        label={label}
        error={error}
        hint={hint}
        secureTextEntry={!visible}
        autoCorrect={false}
        autoCapitalize="none"
        textContentType="password"
        trailingElement={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            hitSlop={8}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={Colors.neutral[400]}
            />
          </Pressable>
        }
        {...props}
      />
    );
  }
);

PasswordField.displayName = "PasswordField";
