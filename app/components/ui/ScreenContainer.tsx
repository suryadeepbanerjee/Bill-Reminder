import { ScrollView, ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenContainerProps extends ScrollViewProps {
  safeArea?: boolean;
}

export function ScreenContainer({
  children,
  safeArea = true,
  contentContainerClassName = "",
  ...props
}: ScreenContainerProps) {
  const content = (
    <ScrollView
      className="flex-1 bg-neutral-50"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={contentContainerClassName}
      {...props}
    >
      {children}
    </ScrollView>
  );

  if (safeArea) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["bottom"]}>
        {content}
      </SafeAreaView>
    );
  }

  return content;
}
