import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/ui/Button";
import { useAuthStore } from "../stores/auth-store";
import { acceptInvite } from "../lib/supabase/profile";
import { Colors } from "../lib/theme";

export default function AcceptInviteScreen() {
  const { hid } = useLocalSearchParams<{ hid: string }>();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "need_login">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!hid) {
      setStatus("error");
      setErrorMsg("Invalid invitation link.");
      return;
    }

    if (!user) {
      setStatus("need_login");
      return;
    }

    (async () => {
      try {
        await acceptInvite(hid);
        setStatus("success");
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e.message ?? "Failed to accept invitation.");
      }
    })();
  }, [hid, user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#080810" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={Colors.accent[500]} />
            <Text style={{ color: "#A3A3A3", fontSize: 15 }}>Accepting invitation...</Text>
          </>
        )}

        {status === "need_login" && (
          <>
            <Ionicons name="log-in-outline" size={48} color={Colors.accent[500]} />
            <Text style={{ color: "#F5F5F5", fontSize: 20, fontWeight: "700", textAlign: "center" }}>
              Sign in required
            </Text>
            <Text style={{ color: "#A3A3A3", fontSize: 15, textAlign: "center" }}>
              You need to sign in to accept this household invitation.
            </Text>
            <Button
              title="Sign in"
              variant="accent"
              onPress={() => router.replace("/(auth)/sign-in")}
            />
          </>
        )}

        {status === "success" && (
          <>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={{ color: "#F5F5F5", fontSize: 20, fontWeight: "700", textAlign: "center" }}>
              Welcome!
            </Text>
            <Text style={{ color: "#A3A3A3", fontSize: 15, textAlign: "center" }}>
              You've joined the household. You can now see and manage shared bills.
            </Text>
            <Button
              title="Go to Dashboard"
              variant="accent"
              onPress={() => router.replace("/(tabs)/dashboard")}
            />
          </>
        )}

        {status === "error" && (
          <>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={{ color: "#F5F5F5", fontSize: 20, fontWeight: "700", textAlign: "center" }}>
              Something went wrong
            </Text>
            <Text style={{ color: "#A3A3A3", fontSize: 15, textAlign: "center" }}>
              {errorMsg}
            </Text>
            <Button
              title="Go back"
              variant="secondary"
              onPress={() => router.replace("/(tabs)/dashboard")}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
