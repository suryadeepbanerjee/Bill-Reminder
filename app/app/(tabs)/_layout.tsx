import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../stores/auth-store";
import { useThemeStore } from "../../stores/theme-store";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  focused,
  resolved,
}: {
  name: [IoniconName, IoniconName];
  focused: boolean;
  resolved: "light" | "dark";
}) {
  const activeColor   = resolved === "dark" ? "#F5F5F5" : "#1C1C1E";
  const inactiveColor = resolved === "dark" ? "#525252" : "#A3A3A3";
  return (
    <Ionicons
      name={focused ? name[1] : name[0]}
      size={22}
      color={focused ? activeColor : inactiveColor}
    />
  );
}

export default function TabsLayout() {
  const { session, isLoading } = useAuthStore();
  const { resolved } = useThemeStore();

  if (isLoading) return null;
  if (!session)  return <Redirect href="/(auth)/sign-in" />;

  const isDark = resolved === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   isDark ? "#F5F5F5" : "#1C1C1E",
        tabBarInactiveTintColor: isDark ? "#525252" : "#A3A3A3",
        tabBarStyle: {
          borderTopWidth:   0.5,
          borderTopColor:   isDark ? "#262626" : "#E5E5E5",
          backgroundColor:  isDark ? "#0A0A0A" : "#FAFAFA",
          elevation:        0,
          height:           Platform.OS === "ios" ? undefined : 60,
          paddingTop:       Platform.OS === "android" ? 4 : 0,
        },
        tabBarLabelStyle: {
          fontSize:    11,
          fontWeight:  "600",
          marginTop:   -2,
          letterSpacing: 0.1,
          marginBottom: Platform.OS === "android" ? 6 : 0,
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
              resolved={resolved}
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
              resolved={resolved}
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
              resolved={resolved}
            />
          ),
        }}
      />
    </Tabs>
  );
}
