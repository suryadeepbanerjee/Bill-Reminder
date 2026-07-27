import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AuthFormContainerProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * Auth screen layout wrapper.
 *
 * Structure:
 * - SafeAreaView (top + bottom)
 * - KeyboardAvoidingView
 * - ScrollView (handles small screens gracefully)
 * - App wordmark block at top
 * - Title + subtitle
 * - Form content
 */
export function AuthFormContainer({ title, subtitle, children }: AuthFormContainerProps) {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 py-10">
            {/* App wordmark */}
            <View className="items-center mb-10">
              <View className="w-14 h-14 rounded-2xl bg-accent-500 items-center justify-center mb-3">
                <Text className="text-white font-bold" style={{ fontSize: 22 }}>BR</Text>
              </View>
              <Text className="text-caption text-neutral-400 dark:text-neutral-500 font-medium">
                Bill Reminder
              </Text>
            </View>

            {/* Title block */}
            <View className="mb-6">
              <Text className="text-display text-neutral-900 dark:text-neutral-50 mb-1.5">
                {title}
              </Text>
              <Text className="text-body text-neutral-500 dark:text-neutral-400 leading-6">
                {subtitle}
              </Text>
            </View>

            {/* Form slot */}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
