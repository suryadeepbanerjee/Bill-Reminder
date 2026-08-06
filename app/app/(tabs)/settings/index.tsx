import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Share, Alert, Pressable, Linking, Image, AppState, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfile, useUpdateProfile } from "../../../hooks/useProfile";
import { useHousehold }   from "../../../hooks/useHousehold";
import { useBills }       from "../../../hooks/useBills";
import { useThemeStore }  from "../../../stores/theme-store";
import { useAuthStore }   from "../../../stores/auth-store";
import { useHouseholdStore } from "../../../stores/household-store";
import { Surface }        from "../../../components/ui/Surface";
import { ListItem }       from "../../../components/ui/ListItem";
import { Button }         from "../../../components/ui/Button";
import { TextInput }      from "../../../components/ui/TextInput";
import { Modal }          from "../../../components/ui/Modal";
import { AlertBadge }     from "../../../components/ui/AlertBadge";
import { Divider }        from "../../../components/ui/Divider";
import { supabase }       from "../../../lib/supabase/client";
import { createHousehold } from "../../../lib/supabase/profile";
import { signOutGoogle }  from "../../../lib/auth/google";
import { cancelAllReminders } from "../../../lib/notifications";
import { Switch }         from "../../../components/ui/Switch";
import { humanize, friendlyError } from "@shared/utils/errors";

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-caption text-secondary font-medium uppercase tracking-widest px-4 mb-2 mt-2">
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

type ThemeMode = "light" | "dark";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light",  label: "Light",  icon: "sunny-outline"    },
  { value: "dark",   label: "Dark",   icon: "moon-outline"     },
];

function ThemeSelector() {
  const { mode, setMode } = useThemeStore();

  return (
    <View className="px-4 py-3">
      <Text className="text-caption text-secondary mb-3">
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
                  ? "bg-toggle-active"
                  : "bg-surface border border-border"
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${opt.label} theme`}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                className={isActive ? "text-primary" : "text-primary"}
              />
              <Text
                className={`text-caption font-medium ${
                  isActive
                    ? "text-primary"
                    : "text-secondary"
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

function EmailNotificationsToggle({ profile }: { profile: any }) {
  const { mutateAsync, isPending } = useUpdateProfile();

  const handleToggle = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await mutateAsync({ email_notifications_enabled: !profile.email_notifications_enabled });
    } catch (e) {
      Alert.alert("Error", "Could not update email preferences");
    }
  };

  return (
    <ListItem
      title="Email notifications"
      subtitle="Receive bill reminders via email"
      leading={<Ionicons name="mail-outline" size={20} className="text-primary" />}
      trailing={
        isPending ? (
          <Text className="text-caption text-secondary font-medium">Saving...</Text>
        ) : (
          <Switch 
            value={!!profile?.email_notifications_enabled} 
            onValueChange={handleToggle} 
          />
        )
      }
      onPress={handleToggle}
    />
  );
}

// ── Notifications Toggle ──────────────────────────────────────────────────────

function PushNotificationsToggle() {
  const [enabled, setEnabled] = useState(false);

  const checkPermissions = async () => {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    setEnabled(status === "granted");
  };

  useEffect(() => {
    checkPermissions();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermissions();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const handleToggle = async () => {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status === "granted") {
      // Direct them to OS settings to disable
      Alert.alert("Disable Notifications", "Please disable notifications in your device settings.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]);
    } else {
      // Request permission
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus === "granted") {
        setEnabled(true);
      } else {
        Alert.alert("Permission Required", "Please enable notifications in your device settings.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]);
      }
    }
  };

  return (
    <ListItem
      title="Push notifications"
      subtitle="Reminders for due and overdue bills"
      leading={<Ionicons name="notifications-outline" size={20} className="text-primary" />}
      trailing={
        <View className="flex-row items-center gap-2">
          <Text className="text-caption text-secondary font-medium">
            {enabled ? "Enabled" : "Disabled"}
          </Text>
          <Ionicons name="chevron-forward" size={16} className="text-primary" />
        </View>
      }
      onPress={handleToggle}
      showDivider
    />
  );
}

// ── Delete Account Sheet ─────────────────────────────────────────────────────

function DeleteAccountSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [step, setStep]           = useState<"confirm" | "otp">("confirm");
  const [otp, setOtp]             = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [sending, setSending]     = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const otpRef = useRef<any>(null);

  // We no longer reset state on `!visible` automatically so that if the OS 
  // forcefully closes the modal when switching apps, the user can resume.
  const handleExplicitClose = () => {
    onClose();
    setTimeout(() => {
      setStep("confirm");
      setOtp("");
      setError(null);
      setSending(false);
      setVerifying(false);
      setCooldown(0);
    }, 300);
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setError(null);
    setSending(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: user?.email ?? "" });
      if (otpError) throw otpError;
      setStep("otp");
      setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSending(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: user?.email ?? "" });
      if (otpError) throw otpError;
      setCooldown(60);
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    } finally {
      setSending(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      // 1. Verify the OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
          email: user?.email ?? "",
          token: otp,
          type: "magiclink",
        });
      if (verifyError) {
        setVerifying(false);
        setError(humanize(verifyError, "auth"));
        return;
      }

      // 2. Cancel all local notifications
      await cancelAllReminders();

      // 3. Get the current session JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please sign in again.");

      // 4. Call the Edge Function to delete all user data + auth user
      const { error } = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      // 5. Sign out from Google if signed in
      await signOutGoogle();

      // 6. Sign out from Supabase
      await supabase.auth.signOut();

      // Navigation happens automatically via auth state change
    } catch (e: any) {
      setError(humanize(e, "auth"));
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" dismissable={step === "confirm" && !verifying}>
      <View className="px-4 pt-4 pb-6 gap-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-title text-primary font-semibold flex-1 mr-2" numberOfLines={2}>
            {step === "confirm" ? "Delete account" : "Verify your identity"}
          </Text>
          {!verifying && (
            <Pressable onPress={handleExplicitClose} hitSlop={12}>
              <Ionicons name="close" size={22} className="text-secondary" />
            </Pressable>
          )}
        </View>

        {error && <AlertBadge message={error} variant="error" />}

        {step === "confirm" ? (
          <>
            <View className="bg-error/10 rounded-card p-4 gap-3">
              <View className="flex-row items-start gap-3">
                <Ionicons name="warning" size={20} className="text-error mt-0.5" />
                <Text className="text-body text-primary flex-1">
                  This will <Text className="font-semibold">permanently delete</Text> your account and all data including:
                </Text>
              </View>
              <View className="ml-8 gap-1.5">
                {["All bills and payment history", "All reminder rules", "Notification preferences", "Push token registrations"].map((item) => (
                  <Text key={item} className="text-caption text-secondary">
                    {"\u2022"} {item}
                  </Text>
                ))}
              </View>
            </View>

            <Text className="text-body text-secondary">
              A verification code will be sent to <Text className="font-medium text-primary">{user?.email}</Text> to confirm this action.
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button title="Cancel" variant="secondary" onPress={handleExplicitClose} fullWidth />
              </View>
              <View className="flex-1">
                <Button
                  title="Send code"
                  variant="destructive"
                  onPress={handleSendOtp}
                  loading={sending}
                  fullWidth
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text className="text-body text-secondary">
              Enter the 6-digit code sent to <Text className="font-medium text-primary">{user?.email}</Text>
            </Text>

            <TextInput
              ref={otpRef}
              label="Verification code"
              value={otp}
              onChangeText={(t) => {
                setOtp(t.replace(/[^0-9]/g, "").slice(0, 6));
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={6}
              placeholder="000000"
              autoFocus
              error={error ? undefined : undefined}
            />

            <Pressable onPress={handleResend} disabled={cooldown > 0} hitSlop={8}>
              <Text className={`text-caption font-medium ${cooldown > 0 ? "text-secondary" : "text-primary"}`}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Text>
            </Pressable>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button title="Cancel" variant="secondary" onPress={handleExplicitClose} fullWidth disabled={verifying} />
              </View>
              <View className="flex-1">
                <Button
                  title="Confirm delete"
                  variant="destructive"
                  onPress={handleVerifyAndDelete}
                  loading={verifying}
                  fullWidth
                  disabled={otp.length !== 6}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// We removed HouseholdSheet to use an inline dropdown instead

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user }           = useAuthStore();
  const { data: profile }       = useProfile();
  const { activeHousehold, households } = useHousehold();
  const { data: bills = [] }    = useBills();
  const setActiveHousehold      = useHouseholdStore((s) => s.setActiveHousehold);
  const setHouseholds           = useHouseholdStore((s) => s.setHouseholds);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showHouseholdDropdown, setShowHouseholdDropdown] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [showNewHouseholdInput, setShowNewHouseholdInput] = useState(false);

  const displayName = profile?.display_name ?? "Your account";
  const version     = "1.0.0";

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim() || !user?.id) return;
    setCreatingHousehold(true);
    try {
      const result = await createHousehold(newHouseholdName.trim(), user.id);
      setHouseholds([...households, result]);
      setActiveHousehold(result);
      setNewHouseholdName("");
      setShowNewHouseholdInput(false);
      setShowHouseholdDropdown(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", friendlyError(e));
    } finally {
      setCreatingHousehold(false);
    }
  };

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
              await cancelAllReminders();
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

  const handleDeleteAccount = () => {
    setShowDeleteSheet(true);
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
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, gap: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ─────────────────────────────────────────────── */}
        <Text className="text-[32px] leading-[40px] font-bold tracking-tight text-primary px-4 pt-4 pb-2">
          Settings
        </Text>

        {/* ── Profile card ────────────────────────────────────────────── */}
        <View className="mx-4">
          <Surface level="resting" bordered rounded="card" className="overflow-hidden">
            <Pressable
              onPress={() => setShowHouseholdDropdown((prev) => !prev)}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              className="flex-row items-center gap-4 px-4 py-4"
            >
              <Ionicons name="person-circle" size={56} className="text-primary" />
              <View className="flex-1">
                <Text className="text-label text-primary font-semibold">
                  {displayName}
                </Text>
                {profile?.email && (
                  <Text className="text-caption text-secondary mt-0.5">
                    {profile.email}
                  </Text>
                )}
                {activeHousehold?.household.name && (
                  <Text className="text-caption text-secondary mt-0.5">
                    {activeHousehold.household.name}
                  </Text>
                )}
              </View>
              <Ionicons name={showHouseholdDropdown ? "chevron-up" : "chevron-down"} size={20} className="text-secondary" />
            </Pressable>

            {/* Dropdown Content */}
            {showHouseholdDropdown && (
              <View className="bg-primary/5 px-3 pb-3 pt-3 border-t border-border/30 gap-3">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-[10px] text-secondary font-bold uppercase tracking-widest">
                    Your Households
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowHouseholdDropdown(false);
                      router.push("/(tabs)/settings/members");
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-[12px] text-accent font-semibold">Manage</Text>
                  </Pressable>
                </View>
                
                <View className="gap-1.5">
                  {households.map((h) => {
                    const isActive = h.household.id === activeHousehold?.household.id;
                    return (
                      <Pressable
                        key={h.household.id}
                        className={`flex-row items-center justify-between py-2.5 px-3 rounded-lg ${
                          isActive ? "bg-surface border border-border shadow-sm" : "bg-transparent"
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        onPress={() => {
                          setActiveHousehold(h);
                          setShowHouseholdDropdown(false);
                        }}
                      >
                        <Text className={`text-[14px] ${isActive ? "text-primary font-bold" : "text-primary/80 font-medium"}`}>
                          {h.household.name}
                        </Text>
                        {isActive && <Ionicons name="checkmark-circle" size={16} className="text-accent" />}
                      </Pressable>
                    );
                  })}

                  {/* ── New household ──────────────────────────────────── */}
                  {showNewHouseholdInput ? (
                    <View className="gap-2 mt-1">
                      <TextInput
                        placeholder="e.g. Family Home"
                        value={newHouseholdName}
                        onChangeText={setNewHouseholdName}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreateHousehold}
                      />
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <Button
                            title={creatingHousehold ? "Creating..." : "Create"}
                            variant="accent"
                            fullWidth
                            onPress={handleCreateHousehold}
                            loading={creatingHousehold}
                            disabled={!newHouseholdName.trim()}
                          />
                        </View>
                        <View className="flex-1">
                          <Button
                            title="Cancel"
                            variant="secondary"
                            fullWidth
                            onPress={() => {
                              setShowNewHouseholdInput(false);
                              setNewHouseholdName("");
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowNewHouseholdInput(true)}
                      className="flex-row items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-border"
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Ionicons name="add-circle-outline" size={18} className="text-accent" />
                      <Text className="text-[14px] font-medium text-accent">
                        New household
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </Surface>
        </View>

        {/* ── Edit Profile ────────────────────────────────────────────── */}
        <Section title="Edit Profile">
          <ListItem
            title="Account settings"
            subtitle="Change name, email, or password"
            leading={<Ionicons name="person-outline" size={20} className="text-primary" />}
            trailing={<Ionicons name="chevron-forward" size={16} className="text-primary" />}
            onPress={() => router.push("/(tabs)/settings/profile")}
          />
        </Section>

        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Section title="Appearance">
          <ThemeSelector />
        </Section>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Section title="Notifications">
          <PushNotificationsToggle />
          {profile && <EmailNotificationsToggle profile={profile} />}
        </Section>

        {/* ── Data ───────────────────────────────────────────────────── */}
        <Section title="Data">
          <ListItem
            title="Export data"
            subtitle="Share a JSON snapshot of your bills"
            leading={<Ionicons name="share-outline" size={20} className="text-primary" />}
            trailing={<Ionicons name="chevron-forward" size={16} className="text-primary" />}
            onPress={handleExport}
            showDivider
          />
          <ListItem
            title="Bills tracked"
            leading={<Ionicons name="receipt-outline" size={20} className="text-primary" />}
            trailing={
              <Text className="text-label text-secondary font-semibold font-mono tabular-nums">
                {bills.length}
              </Text>
            }
          />
        </Section>

        {/* ── About ──────────────────────────────────────────────────── */}
        <Section title="About">
          <ListItem
            title="Version"
            leading={<Ionicons name="information-circle-outline" size={20} className="text-primary" />}
            trailing={
              <Text className="text-caption text-secondary font-mono tabular-nums">{version}</Text>
            }
            showDivider
          />
          <ListItem
            title="GitHub"
            subtitle="View source code"
            leading={<Ionicons name="logo-github" size={20} className="text-primary" />}
            trailing={<Ionicons name="open-outline" size={16} className="text-primary" />}
            onPress={() => Linking.openURL("https://github.com/suryadeepbanerjee/Bill-Reminder")}
            showDivider
          />
          <ListItem
            title="Privacy policy"
            leading={<Ionicons name="shield-outline" size={20} className="text-primary" />}
            trailing={<Ionicons name="chevron-forward" size={16} className="text-primary" />}
            onPress={() => Linking.openURL("https://billreminder.suryadeepbanerjee.in/privacy")}
            showDivider
          />
          <ListItem
            title="Terms of service"
            leading={<Ionicons name="document-text-outline" size={20} className="text-primary" />}
            trailing={<Ionicons name="chevron-forward" size={16} className="text-primary" />}
            onPress={() => Linking.openURL("https://billreminder.suryadeepbanerjee.in/terms")}
          />
        </Section>

        {/* ── Danger Zone ────────────────────────────────────────────── */}
        <View className="px-4 pt-6 pb-2 gap-3">
          <Button
            title="Sign out"
            variant="secondary"
            fullWidth
            onPress={handleSignOut}
          />
          <Button
            title="Delete account"
            variant="destructive"
            fullWidth
            onPress={handleDeleteAccount}
          />
        </View>
      </ScrollView>

      {/* ── Delete Account sheet ────────────────────────────────────── */}
      <DeleteAccountSheet
        visible={showDeleteSheet}
        onClose={() => setShowDeleteSheet(false)}
      />
    </SafeAreaView>
  );
}
