import { useState } from "react";
import { View, Text, ScrollView, Share, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfile, useUpdateProfile } from "../../../hooks/useProfile";
import { useHousehold }   from "../../../hooks/useHousehold";
import { useBills }       from "../../../hooks/useBills";
import { Screen }         from "../../../components/ui/Screen";
import { Surface }        from "../../../components/ui/Surface";
import { ListItem }       from "../../../components/ui/ListItem";
import { Divider }        from "../../../components/ui/Divider";
import { Button }         from "../../../components/ui/Button";
import { TextInput }      from "../../../components/ui/TextInput";
import { Modal }          from "../../../components/ui/Modal";
import { AlertBadge }     from "../../../components/ui/AlertBadge";
import { Colors }         from "../../../lib/theme";
import { supabase }       from "../../../lib/supabase/client";

// ── Profile avatar ────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <View className="w-14 h-14 rounded-full bg-accent-500 items-center justify-center">
      <Text className="text-white font-bold text-xl">
        {initials || "?"}
      </Text>
    </View>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-caption text-neutral-500 dark:text-neutral-400 font-medium px-4 mb-1.5">
        {title}
      </Text>
      <Surface level="resting" bordered rounded="card" className="mx-4 overflow-hidden">
        {children}
      </Surface>
    </View>
  );
}

// ── Edit name modal ───────────────────────────────────────────────────────────

function EditNameModal({
  visible,
  currentName,
  onClose,
}: {
  visible:     boolean;
  currentName: string;
  onClose:     () => void;
}) {
  const [name, setName]     = useState(currentName);
  const [error, setError]   = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateProfile();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    if (trimmed.length > 50) { setError("Name must be 50 characters or less."); return; }
    setError(null);
    try {
      await mutateAsync({ display_name: trimmed });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update name.");
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View className="px-4 pt-4 pb-6 gap-4">
        <Text className="text-title text-neutral-900 dark:text-neutral-50 font-semibold">
          Edit name
        </Text>
        {error && <AlertBadge message={error} variant="error" />}
        <TextInput
          label="Display name"
          value={name}
          onChangeText={setName}
          autoFocus
          maxCharacters={50}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button title="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View className="flex-1">
            <Button title="Save" variant="accent" onPress={handleSave} loading={isPending} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [showEditName, setShowEditName] = useState(false);

  const { data: profile }      = useProfile();
  const { data: householdData } = useHousehold();
  const { data: bills = [] }   = useBills();

  const displayName = profile?.display_name ?? "Your account";
  const email = supabase.auth.getUser().then ? undefined : undefined; // async, show from session

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text:    "Sign out",
          style:   "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/(auth)/sign-in");
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const payload = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          bills:       bills.map((b) => ({
            title:         b.title,
            provider_name: b.provider_name,
            behavior_type: b.behavior_type,
            amount_expected: b.amount_expected,
            currency:      b.currency,
            repeat_kind:   b.repeat_kind,
            category:      b.categories?.name,
          })),
        },
        null,
        2
      );
      await Share.share({ message: payload, title: "Bill Reminder export" });
    } catch {
      Alert.alert("Export failed", "Could not export your data.");
    }
  };

  const version = "1.0.0 (1)";

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, gap: 24, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ─────────────────────────────────────────────── */}
        <Text className="text-display text-neutral-900 dark:text-neutral-50 px-4 mb-2">
          Settings
        </Text>

        {/* ── Profile ────────────────────────────────────────────────── */}
        <Section title="Account">
          <Pressable
            onPress={() => setShowEditName(true)}
            className="flex-row items-center gap-4 px-4 py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Avatar name={displayName} />
            <View className="flex-1">
              <Text className="text-label text-neutral-900 dark:text-neutral-100 font-semibold">
                {displayName}
              </Text>
              {householdData?.household.name && (
                <Text className="text-caption text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {householdData.household.name}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.neutral[400]} />
          </Pressable>
        </Section>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Section title="Notifications">
          <ListItem
            title="Push notifications"
            subtitle="Reminders for due and overdue bills"
            leading={<Ionicons name="notifications-outline" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />}
            showDivider
          />
          <ListItem
            title="Email notifications"
            subtitle="Important milestones via email"
            leading={<Ionicons name="mail-outline" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />}
          />
        </Section>

        {/* ── Data ───────────────────────────────────────────────────── */}
        <Section title="Data">
          <ListItem
            title="Export data"
            subtitle="Share a JSON snapshot of your bills"
            leading={<Ionicons name="share-outline" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />}
            onPress={handleExport}
            showDivider
          />
          <ListItem
            title="Bills tracked"
            leading={<Ionicons name="receipt-outline" size={20} color={Colors.neutral[500]} />}
            trailing={
              <Text className="text-body text-neutral-500 dark:text-neutral-400 font-medium">
                {bills.length}
              </Text>
            }
          />
        </Section>

        {/* ── About ──────────────────────────────────────────────────── */}
        <Section title="About">
          <ListItem
            title="Version"
            leading={<Ionicons name="information-circle-outline" size={20} color={Colors.neutral[500]} />}
            trailing={
              <Text className="text-body text-neutral-400">{version}</Text>
            }
            showDivider
          />
          <ListItem
            title="Privacy policy"
            leading={<Ionicons name="shield-outline" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />}
            showDivider
          />
          <ListItem
            title="Terms of service"
            leading={<Ionicons name="document-text-outline" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />}
          />
        </Section>

        {/* ── Sign out ───────────────────────────────────────────────── */}
        <View className="px-4">
          <Button
            title="Sign out"
            variant="destructive"
            fullWidth
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>

      {/* Modals */}
      <EditNameModal
        visible={showEditName}
        currentName={profile?.display_name ?? ""}
        onClose={() => setShowEditName(false)}
      />
    </SafeAreaView>
  );
}

