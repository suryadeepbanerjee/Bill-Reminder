import { useState } from "react";
import { View, Text, ScrollView, Share, Alert, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfile, useUpdateProfile } from "../../../hooks/useProfile";
import { useHousehold }   from "../../../hooks/useHousehold";
import { useBills }       from "../../../hooks/useBills";
import { useThemeStore }  from "../../../stores/theme-store";
import { Surface }        from "../../../components/ui/Surface";
import { ListItem }       from "../../../components/ui/ListItem";
import { Button }         from "../../../components/ui/Button";
import { TextInput }      from "../../../components/ui/TextInput";
import { Modal }          from "../../../components/ui/Modal";
import { AlertBadge }     from "../../../components/ui/AlertBadge";
import { Colors }         from "../../../lib/theme";
import { supabase }       from "../../../lib/supabase/client";
import { signOutGoogle }  from "../../../lib/auth/google";
// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      style={{
        width:           size,
        height:          size,
        borderRadius:    size / 2,
        backgroundColor: Colors.accent[500],
        alignItems:      "center",
        justifyContent:  "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-caption text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-widest px-4 mb-2 mt-2">
      {title}
    </Text>
  );
}

// ── Grouped section ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <SectionHeader title={title} />
      <Surface level="resting" bordered rounded="card" className="mx-4 overflow-hidden">
        {children}
      </Surface>
    </View>
  );
}

// ── Theme selector ────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light",  label: "Light",  icon: "sunny-outline"    },
  { value: "dark",   label: "Dark",   icon: "moon-outline"     },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

function ThemeSelector() {
  const { mode, setMode } = useThemeStore();

  return (
    <View className="px-4 py-3">
      <Text className="text-caption text-neutral-500 dark:text-neutral-400 mb-3">
        Appearance
      </Text>
      <View className="flex-row gap-2">
        {THEME_OPTIONS.map((opt) => {
          const isActive = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode(opt.value);
              }}
              className={`flex-1 rounded-input py-3 items-center gap-1.5 ${
                isActive
                  ? "bg-neutral-900 dark:bg-neutral-100"
                  : "bg-neutral-100 dark:bg-neutral-800"
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${opt.label} theme`}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={isActive
                  ? (mode === "dark" ? Colors.neutral[900] : Colors.white)
                  : Colors.neutral[500]
                }
              />
              <Text
                className={`text-caption font-medium ${
                  isActive
                    ? "text-white dark:text-neutral-900"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

  const { data: profile }       = useProfile();
  const { data: householdData } = useHousehold();
  const { data: bills = [] }    = useBills();

  const displayName = profile?.display_name ?? "Your account";
  const version     = "1.0.0";

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
            try {
              await signOutGoogle();
              await supabase.auth.signOut();
            } catch (error) {
              console.error("Error signing out:", error);
            }
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
          bills: bills.map((b) => ({
            title:           b.title,
            provider_name:   b.provider_name,
            behavior_type:   b.behavior_type,
            amount_expected: b.amount_expected,
            currency:        b.currency,
            repeat_kind:     b.repeat_kind,
            category:        b.categories?.name,
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

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, gap: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ─────────────────────────────────────────────── */}
        <Text className="text-display text-neutral-900 dark:text-neutral-50 px-4 pt-4 pb-2">
          Settings
        </Text>

        {/* ── Profile card ────────────────────────────────────────────── */}
        <View className="mx-4">
          <Surface level="resting" bordered rounded="card" className="overflow-hidden">
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
              <Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />
            </Pressable>
          </Surface>
        </View>

        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Section title="Appearance">
          <ThemeSelector />
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
              <Text className="text-label text-neutral-500 dark:text-neutral-400 font-semibold">
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
              <Text className="text-caption text-neutral-400">{version}</Text>
            }
            showDivider
          />
          <ListItem
            title="GitHub"
            subtitle="View source code"
            leading={<Ionicons name="logo-github" size={20} color={Colors.neutral[500]} />}
            trailing={<Ionicons name="open-outline" size={16} color={Colors.neutral[400]} />}
            onPress={() => Linking.openURL("https://github.com/suryadeepbanerjee/Bill-Reminder")}
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
        <View className="px-4 pt-2">
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
