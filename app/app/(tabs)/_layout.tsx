import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../stores/auth-store";
import { useAppTokens } from "../../lib/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  focused,
  tokens,
}: {
  name: [IoniconName, IoniconName];
  focused: boolean;
  tokens: ReturnType<typeof useAppTokens>;
}) {
  return (
    <Ionicons
      name={focused ? name[1] : name[0]}
      size={22}
      color={focused ? tokens.primary : tokens.secondary}
    />
  );
}

export default function TabsLayout() {
  const { session, isLoading } = useAuthStore();
  const tokens = useAppTokens();
  const insets = useSafeAreaInsets();

  // Use router.replace() inside useEffect rather than <Redirect>.
  // <Redirect> uses useFocusEffect → useNavigation() from @react-navigation/native,
  // which throws "no navigation context" when this layout returns null during loading.
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/(auth)/sign-in");
    }
  }, [isLoading, session]);

  if (isLoading || !session) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   tokens.primary,
        tabBarInactiveTintColor: tokens.secondary,
        tabBarStyle: {
          borderTopWidth:   0.5,
          borderTopColor:   tokens.border,
          backgroundColor:  tokens.canvas,
          elevation:        0,
          height:           Platform.OS === "android" ? 60 + insets.bottom : undefined,
          paddingBottom:    Platform.OS === "android" ? insets.bottom : undefined,
          paddingTop:       Platform.OS === "android" ? 8 : 0,
        },
        tabBarLabelStyle: {
          fontSize:    11,
          fontWeight:  "600",
          marginTop:   -2,
          letterSpacing: 0.1,
          marginBottom: Platform.OS === "android" ? 8 : 0,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === "android" ? 4 : 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={["grid-outline", "grid"]}
              focused={focused}
              tokens={tokens}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: "Bills",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={["receipt-outline", "receipt"]}
              focused={focused}
              tokens={tokens}
            />
          ),
        }}
      />
      {/* Add — hidden from tab bar; opened as modal via FAB */}
      <Tabs.Screen
        name="add"
        options={{
          href:  null,
          title: "Add",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={["person-circle-outline", "person-circle"]}
              focused={focused}
              tokens={tokens}
            />
          ),
        }}
      />
    </Tabs>
  );
}
