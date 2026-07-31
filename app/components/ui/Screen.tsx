import { ScrollView, View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "./Header";

type Edge = "top" | "bottom" | "left" | "right";

interface ScreenProps {
  children: React.ReactNode;
  /** Title shown in the built-in Header. If omitted, no header is rendered. */
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Defaults to ['top','bottom']. Pass [] to opt-out of SafeArea. */
  edges?: Edge[];
  /** When true, content is not wrapped in a ScrollView (for flat lists etc.) */
  noScroll?: boolean;
  /** Passed to the inner View or ScrollView content area */
  contentClassName?: string;
  style?: ViewProps["style"];
}

export function Screen({
  children,
  title,
  subtitle,
  showBack,
  onBack,
  rightAction,
  edges = ["top", "bottom"],
  noScroll = false,
  contentClassName = "",
  style,
}: ScreenProps) {
  const inner = noScroll ? (
    <View className={`flex-1 bg-canvas ${contentClassName}`} style={style}>
      {children}
    </View>
  ) : (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className={contentClassName} style={style}>
        {children}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={edges}>
      {title && (
        <Header
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction}
        />
      )}
      {inner}
    </SafeAreaView>
  );
}
