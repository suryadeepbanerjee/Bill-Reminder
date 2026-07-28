import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface AuthFormContainerProps {
  title:        string;
  subtitle:     string;
  children:     React.ReactNode;
  showBack?:    boolean;
  footer?:      React.ReactNode;
}

export function AuthFormContainer({
  title,
  subtitle,
  children,
  showBack = false,
  footer,
}: AuthFormContainerProps) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
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
                <Ionicons name="chevron-back" size={20} className="text-secondary" />
                <Text className="text-body text-secondary">Back</Text>
              </Pressable>
            )}

            {/* Logo mark */}
            <View className="items-center mb-10">
              <View
                className="items-center justify-center mb-4 bg-accent shadow-resting"
                style={{
                  width:           56,
                  height:          56,
                  borderRadius:    16,
                }}
              >
                <Ionicons name="notifications" size={26} className="text-accent-text" />
              </View>
              <Text className="text-caption text-secondary font-semibold tracking-[0.2em]">
                BILL REMINDER
              </Text>
            </View>

            {/* Title block */}
            <View className="mb-8">
              <Text className="text-[32px] leading-[40px] font-bold tracking-tight text-primary mb-2 text-center">
                {title}
              </Text>
              <Text className="text-body text-secondary leading-6 text-center">
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
