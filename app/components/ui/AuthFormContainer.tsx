import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../lib/theme";

interface AuthFormContainerProps {
  title:        string;
  subtitle:     string;
  children:     React.ReactNode;
  showBack?:    boolean;
  /** Optional content rendered below the form but inside the card scroll area */
  footer?:      React.ReactNode;
}

/**
 * Premium auth screen layout wrapper.
 *
 * Renders:
 * - Safe area (top + bottom)
 * - KeyboardAvoidingView
 * - ScrollView (handles small screens gracefully)
 * - App logomark + wordmark
 * - Large title + subtitle
 * - Form content slot
 */
export function AuthFormContainer({
  title,
  subtitle,
  children,
  showBack = false,
  footer,
}: AuthFormContainerProps) {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4 pb-10 justify-center">
            {/* Back button */}
            {showBack && (
              <Pressable
                onPress={() => router.back()}
                className="flex-row items-center gap-1 mb-8 self-start"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={20} color={Colors.neutral[500]} />
                <Text className="text-body text-neutral-500 dark:text-neutral-400">Back</Text>
              </Pressable>
            )}

            {/* Logo mark */}
            <View className="items-center mb-10">
              <View
                className="items-center justify-center mb-3"
                style={{
                  width:           52,
                  height:          52,
                  borderRadius:    14,
                  backgroundColor: Colors.accent[500],
                }}
              >
                {/* Bell icon */}
                <Ionicons name="notifications" size={24} color="#fff" />
              </View>
              <Text className="text-caption text-neutral-400 dark:text-neutral-500 font-semibold tracking-wide">
                BILL REMINDER
              </Text>
            </View>

            {/* Title block */}
            <View className="mb-7">
              <Text
                className="text-neutral-900 dark:text-neutral-50 font-bold mb-2"
                style={{ fontSize: 28, letterSpacing: -0.5, lineHeight: 34 }}
              >
                {title}
              </Text>
              <Text className="text-body text-neutral-500 dark:text-neutral-400 leading-6">
                {subtitle}
              </Text>
            </View>

            {/* Form slot */}
            {children}

            {/* Footer */}
            {footer && <View className="mt-8">{footer}</View>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
