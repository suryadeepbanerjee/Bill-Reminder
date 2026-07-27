import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../stores/auth-store";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../lib/theme";
import { Platform } from "react-native";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  focused,
}: {
  name: [IoniconName, IoniconName]; // [inactive, active]
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name[1] : name[0]}
      size={22}
      color={focused ? Colors.neutral[900] : Colors.neutral[400]}
    />
  );
}

export default function TabsLayout() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!session)  return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.neutral[900],
        tabBarInactiveTintColor: Colors.neutral[400],
        tabBarStyle: {
          borderTopWidth:   0.5,
          borderTopColor:   Colors.neutral[200],
          backgroundColor:  Colors.neutral[50],
          // On Android, the tab bar has a slight shadow upward
          elevation:        0,
          height:           Platform.OS === "ios" ? undefined : 60,
        },
        tabBarLabelStyle: {
          fontSize:    11,
          fontWeight:  "500",
          marginTop:   -2,
          marginBottom: Platform.OS === "android" ? 4 : 0,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={["grid-outline", "grid"]}
              focused={focused}
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
            />
          ),
        }}
      />
      {/* Add — hidden from tab bar; opened as modal via FAB */}
      <Tabs.Screen
        name="add"
        options={{
          href:  null, // removes from tab bar entirely
          title: "Add",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={["person-outline", "person"]}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
