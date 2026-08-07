import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import { Surface } from "../../../components/ui/Surface";
import { Modal } from "../../../components/ui/Modal";
import { AlertBadge } from "../../../components/ui/AlertBadge";
import { InviteResendButton } from "../../../components/household/InviteResendButton";
import { useAuthStore } from "../../../stores/auth-store";
import { useAppTokens } from "../../../lib/tokens";
import { useHouseholdStore } from "../../../stores/household-store";
import {
  fetchHouseholdMembers,
  ensureAtLeastOneHousehold,
  inviteToHousehold,
  leaveToHousehold,
  membershipExists,
  removeMember,
  renameHousehold,
  deleteHousehold,
  transferOwnershipRequest,
  transferOwnershipConfirm,
  setMemberRole,
} from "../../../lib/supabase/profile";
import { friendlyError } from "@shared/utils/errors";
import { isSuperAdmin, canEditBills, canInviteMembers } from "@shared/utils/roles";
import type { HouseholdMember, Profile, HouseholdRole } from "@shared/types";

const INVITE_EXPIRY_HOURS = 24;
const REINVITE_COOLDOWN_HOURS = 1;

function isInviteExpired(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hoursElapsed = (now - created) / (1000 * 60 * 60);
  return hoursElapsed > INVITE_EXPIRY_HOURS;
}

function isInviteWithinCooldown(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hoursElapsed = (now - created) / (1000 * 60 * 60);
  return hoursElapsed < REINVITE_COOLDOWN_HOURS;
}

// ── Transfer Ownership Sheet ──────────────────────────────────────────────────

function TransferOwnershipSheet({
  visible,
  onClose,
  householdId,
  targetMember,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  householdId: string;
  targetMember: { member: HouseholdMember; profile: Profile | null } | null;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<any>(null);

  const targetName = targetMember?.profile?.display_name ?? targetMember?.member.invited_email?.split("@")[0] ?? "this member";

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
    if (!targetMember) return;
    setError(null);
    setSending(true);
    try {
      await transferOwnershipRequest(householdId, targetMember.member.id);
      setStep("otp");
      setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !targetMember) return;
    setError(null);
    setSending(true);
    try {
      await transferOwnershipRequest(householdId, targetMember.member.id);
      setCooldown(60);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6 || !targetMember) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await transferOwnershipConfirm(householdId, targetMember.member.id, otp);
      onSuccess();
      handleExplicitClose();
    } catch (e: any) {
      setError(friendlyError(e));
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom" dismissable={step === "confirm" && !verifying}>
      <View className="px-4 pt-4 pb-6 gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-title text-primary font-semibold flex-1 mr-2" numberOfLines={2}>
            {step === "confirm" ? "Transfer Ownership" : "Verify your identity"}
          </Text>
          {!verifying && (
            <Pressable onPress={handleExplicitClose} hitSlop={12}>
              <Ionicons name="close" size={22} className="text-secondary" />
            </Pressable>
          )}
        </View>

        {error ? <AlertBadge message={error} variant="error" /> : null}

        {step === "confirm" ? (
          <>
            <View className="bg-accent/10 rounded-card p-4 gap-3">
              <View className="flex-row items-start gap-3">
                <Ionicons name="warning" size={20} className="text-accent mt-0.5" />
                <Text className="text-body text-primary flex-1">
                  You are about to transfer ownership to <Text className="font-semibold">{targetName}</Text>.
                </Text>
              </View>
              <View className="ml-8 gap-1.5">
                <Text className="text-caption text-secondary">
                  {"\u2022"} They will become the Owner.
                </Text>
                <Text className="text-caption text-secondary">
                  {"\u2022"} You will be downgraded to an Admin.
                </Text>
                <Text className="text-caption text-secondary">
                  {"\u2022"} This action cannot be undone.
                </Text>
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
                  variant="accent"
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
                  title="Confirm Transfer"
                  variant="accent"
                  onPress={handleVerify}
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

// ── Role Change Sheet ────────────────────────────────────────────────────────

function RoleChangeSheet({
  visible,
  onClose,
  targetMember,
  onRoleChange,
}: {
  visible: boolean;
  onClose: () => void;
  targetMember: { member: HouseholdMember; profile: Profile | null } | null;
  onRoleChange: (role: HouseholdRole) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  if (!targetMember) return null;
  const currentRole = targetMember.member.role;
  const name = targetMember.profile?.display_name ?? targetMember.member.invited_email?.split("@")[0] ?? "Member";

  const handleSelect = async (role: HouseholdRole) => {
    if (role === currentRole) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onRoleChange(role);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View className="px-4 pt-4 pb-6 gap-4">
        <View className="flex-row items-center justify-between border-b border-border pb-4">
          <View>
            <Text className="text-title text-primary font-semibold">Change Role</Text>
            <Text className="text-caption text-secondary mt-1">For {name}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} className="text-secondary" />
          </Pressable>
        </View>

        <View className="gap-3">
          <Pressable
            onPress={() => handleSelect("admin")}
            disabled={saving}
            className={`p-4 rounded-xl border ${currentRole === "admin" ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
          >
            <View className="flex-row justify-between items-center mb-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield" size={18} color="#3B82F6" />
                <Text className={`text-body font-semibold ${currentRole === "admin" ? "text-accent" : "text-primary"}`}>Admin</Text>
              </View>
              {currentRole === "admin" && <Ionicons name="checkmark-circle" size={20} className="text-accent" />}
            </View>
            <Text className="text-caption text-secondary">
              Can manage bills, edit household details, and invite members. Cannot delete household or transfer ownership.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelect("member")}
            disabled={saving}
            className={`p-4 rounded-xl border ${currentRole === "member" ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
          >
            <View className="flex-row justify-between items-center mb-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="person" size={18} color="#737373" />
                <Text className={`text-body font-semibold ${currentRole === "member" ? "text-accent" : "text-primary"}`}>Member</Text>
              </View>
              {currentRole === "member" && <Ionicons name="checkmark-circle" size={20} className="text-accent" />}
            </View>
            <Text className="text-caption text-secondary">
              Can view bills and receive notifications. Cannot add, edit, or mark bills as paid.
            </Text>
          </Pressable>
        </View>

        {saving && (
          <View className="absolute inset-0 z-50 bg-black/50 items-center justify-center rounded-t-3xl">
            <ActivityIndicator size="large" color="#D1A920" />
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function MembersScreen() {
  const { user } = useAuthStore();
  const tokens = useAppTokens();
  const activeHousehold = useHouseholdStore((s) => s.activeHousehold);
  const setHouseholds = useHouseholdStore((s) => s.setHouseholds);
  const households = useHouseholdStore((s) => s.households);
  const [emailToInvite, setEmailToInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [creatingHousehold, setCreatingHousehold] = useState(false);

  const [members, setMembers] = useState<{
    member: HouseholdMember;
    profile: Profile | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRoleChangeSheet, setShowRoleChangeSheet] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{member: HouseholdMember, profile: Profile | null} | null>(null);
  const [showTransferSheet, setShowTransferSheet] = useState(false);

  const queryClient = useQueryClient();

  const householdId = activeHousehold?.household.id ?? "";
  const myRole = activeHousehold?.member.role ?? null;
  const isOwner = isSuperAdmin(myRole);
  const canEdit = canEditBills(myRole);
  const canInvite = canInviteMembers(myRole);

  const refreshHouseholds = async () => {
    if (!user?.id) return;
    try {
      const list = await ensureAtLeastOneHousehold(user.id);
      setHouseholds(list);
      queryClient.invalidateQueries({ queryKey: ["households", user?.id] });
      const activeId = activeHousehold?.household.id;
      if (!list.some((h) => h.household.id === activeId) && list.length > 0) {
        await useHouseholdStore.getState().setActiveHousehold(list[0]);
      }
    } catch {}
  };

  useEffect(() => {
    if (!householdId) return;
    setLoading(true);
    fetchHouseholdMembers(householdId)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [householdId]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.member.status !== "invited") return true;
      return !isInviteExpired(m.member.created_at);
    });
  }, [members]);

  const [inviteError, setInviteError] = useState("");

  const handleInvite = async () => {
    setInviteError("");
    const email = emailToInvite.trim().toLowerCase();
    if (!email) {
      setInviteError("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    if (!householdId) return;

    const recentInvite = members.find(
      (m) => m.member.status === "invited" && m.member.invited_email === email
    );
    if (recentInvite && isInviteWithinCooldown(recentInvite.member.created_at)) {
      const created = new Date(recentInvite.member.created_at).getTime();
      const hoursElapsed = (Date.now() - created) / (1000 * 60 * 60);
      const hoursLeft = Math.ceil(REINVITE_COOLDOWN_HOURS - hoursElapsed);
      setInviteError(`This email was already invited. Please wait ${hoursLeft}h before re-inviting.`);
      return;
    }

    setInviting(true);
    try {
      await inviteToHousehold(householdId, email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Invite Sent", `An invitation has been sent to ${email}.`);
      setEmailToInvite("");
      setInviteError("");
      const updated = await fetchHouseholdMembers(householdId);
      setMembers(updated);
    } catch (e: any) {
      setInviteError(friendlyError(e));
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (member: HouseholdMember) => {
    const email = member.invited_email ?? "";
    if (!email || !householdId) return;
    try {
      await inviteToHousehold(householdId, email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await fetchHouseholdMembers(householdId);
      setMembers(updated);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Couldn't Resend", friendlyError(e));
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberName} from the household?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setSyncing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              const updated = await fetchHouseholdMembers(householdId);
              if (!updated.some((m) => m.member.id === memberId)) {
                setMembers(updated);
                setSyncing(false);
                Alert.alert("Already Removed", `${memberName} has already been removed from this household.`);
                return;
              }
              setSyncing(false);

              await removeMember(memberId);
              setMembers((prev) => prev.filter((m) => m.member.id !== memberId));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              setSyncing(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const raw = e instanceof Error ? e.message : String(e ?? "");
              if (/no rows? updated|already been removed|not found/i.test(raw)) {
                try {
                  const fresh = await fetchHouseholdMembers(householdId);
                  setMembers(fresh);
                } catch {}
                Alert.alert("Already Removed", `${memberName} has already been removed from this household.`);
              } else {
                Alert.alert("Error", friendlyError(e));
              }
            }
          },
        }
      ]
    );
  };

  const handleRoleChange = async (role: HouseholdRole) => {
    if (!selectedMember || !householdId) return;
    try {
      await setMemberRole(selectedMember.member.id, role);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await fetchHouseholdMembers(householdId);
      setMembers(updated);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Role Update Failed", friendlyError(e));
    }
  };

  const handleTransferOwnershipSuccess = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Ownership Transferred", "You are now an Admin in this household.");
    await refreshHouseholds();
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !householdId) return;
    setRenaming(true);
    try {
      await renameHousehold(householdId, renameValue.trim());
      const updated = households.map((h) =>
        h.household.id === householdId
          ? { ...h, household: { ...h.household, name: renameValue.trim() } }
          : h
      );
      setHouseholds(updated);
      if (activeHousehold?.household.id === householdId) {
        const match = updated.find((h) => h.household.id === householdId);
        if (match) {
          useHouseholdStore.getState().setActiveHousehold(match);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRename(false);
    } catch (e: any) {
      Alert.alert("Error", friendlyError(e));
    } finally {
      setRenaming(false);
    }
  };

  const handleSetDefault = async (hh: { household: any; member: any }) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      useHouseholdStore.getState().setActiveHousehold(hh);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not set default.");
    }
  };

  const handleCreateHousehold = async () => {
    const name = newHouseholdName.trim();
    if (!name || !user?.id) return;
    setCreatingHousehold(true);
    try {
      const { createHousehold } = await import("../../../lib/supabase/profile");
      const result = await createHousehold(name, user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newList = [...households, result];
      setHouseholds(newList);
      useHouseholdStore.getState().setActiveHousehold(result);
      setShowCreateHousehold(false);
      setNewHouseholdName("");
    } catch (e: any) {
      Alert.alert("Error", friendlyError(e));
    } finally {
      setCreatingHousehold(false);
    }
  };

  const handleDeleteHousehold = (targetId: string) => {
    const target = households.find(h => h.household.id === targetId);
    if (!target) return;
    if (targetId === activeHousehold?.household.id) {
      Alert.alert("Cannot delete", "You cannot delete your default household. Set another household as default first.");
      return;
    }
    Alert.alert(
      "Delete Household",
      `Are you sure you want to delete "${target.household.name}"? This will permanently remove all bills, members, and data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSyncing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              const { exists, status } = await membershipExists(targetId, user?.id ?? "");
              if (!exists || status !== "super_admin") {
                await refreshHouseholds();
                setSyncing(false);
                Alert.alert("Error", `"${target.household.name}" could not be deleted or you do not have permission.`);
                return;
              }
              setSyncing(false);

              setDeleting(true);
              await deleteHousehold(targetId);
              const remaining = households.filter((h) => h.household.id !== targetId);
              setHouseholds(remaining);
              if (activeHousehold?.household.id === targetId && remaining.length > 0) {
                useHouseholdStore.getState().setActiveHousehold(remaining[0]);
              }
              queryClient.invalidateQueries({ queryKey: ["households", user?.id] });
              queryClient.invalidateQueries({ queryKey: ["bills", targetId] });
              queryClient.invalidateQueries({ queryKey: ["dashboard", targetId] });
              queryClient.invalidateQueries({ queryKey: ["householdCategories", targetId] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              setSyncing(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const raw = e instanceof Error ? e.message : String(e ?? "");
              if (/only owner|only-owner/i.test(raw)) {
                Alert.alert("Error", friendlyError(e));
              } else {
                await refreshHouseholds();
                Alert.alert("Already Deleted", `"${target.household.name}" has already been deleted.`);
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveHousehold = async () => {
    if (!householdId || !user?.id) return;

    setSyncing(true);
    try {
      const { exists, status } = await membershipExists(householdId, user.id);
      if (!exists || status !== "active") {
        await refreshHouseholds();
        setSyncing(false);
        Alert.alert("Already Left", "You've already left this household.");
        return;
      }
    } catch (e: any) {
      setSyncing(false);
      Alert.alert("Error", friendlyError(e));
      return;
    }
    setSyncing(false);

    Alert.alert(
      "Leave this household?",
      `We'll email a confirmation link to verify it's really you. Once confirmed, you will lose access to "${activeHousehold?.household.name ?? "this household"}" and its bills.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send link",
          style: "destructive",
          onPress: async () => {
            try {
              setLeaving(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await leaveToHousehold(householdId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Check your inbox", res.message ?? "We've sent a confirmation link to your email.");
            } catch (e: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const raw = e instanceof Error ? e.message : String(e ?? "");
              if (/not an active member|already left/i.test(raw)) {
                await refreshHouseholds();
                Alert.alert("Already Left", "You've already left this household.");
              } else {
                Alert.alert("Error", friendlyError(e));
              }
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const getMemberName = (m: { member: HouseholdMember; profile: Profile | null }) => {
    return m.profile?.display_name ?? m.member.invited_email?.split("@")[0] ?? "Unknown";
  };

  const getMemberEmail = (m: { member: HouseholdMember; profile: Profile | null }) => {
    return m.profile?.email ?? m.member.invited_email ?? "";
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Manage Household",
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: tokens.canvas },
          headerTintColor: tokens.primary,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="mr-4"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={tokens.primary} />
            </Pressable>
          ),
        }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {isOwner && (
            <View>
              <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
                Household Name
              </Text>
              <Surface level="resting" bordered rounded="card" className="p-4 gap-3">
                {showRename ? (
                  <>
                    <TextInput
                      label="Household name"
                      placeholder="Enter new name"
                      value={renameValue}
                      onChangeText={setRenameValue}
                    />
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Button
                          title="Cancel"
                          variant="secondary"
                          fullWidth
                          onPress={() => {
                            setShowRename(false);
                            setRenameValue("");
                          }}
                        />
                      </View>
                      <View className="flex-1">
                        <Button
                          title="Save"
                          variant="accent"
                          fullWidth
                          onPress={handleRename}
                          loading={renaming}
                          disabled={!renameValue.trim()}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setRenameValue(activeHousehold?.household.name ?? "");
                      setShowRename(true);
                    }}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-body text-primary">
                      {activeHousehold?.household.name ?? "Household"}
                    </Text>
                    <Ionicons name="pencil-outline" size={18} className="text-accent" />
                  </Pressable>
                )}
              </Surface>
            </View>
          )}

          {canInvite && (
            <View>
              <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
                Invite a user
              </Text>
              <Surface level="resting" bordered rounded="card" className="p-4 gap-4">
                <Text className="text-body text-secondary">
                  Send an invitation link to a user. Once they accept, they will be able to see and manage bills in this household.
                </Text>
                <TextInput
                  label="Email address"
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={emailToInvite}
                  onChangeText={setEmailToInvite}
                />
                {inviteError ? (
                  <Text className="text-caption text-error">{inviteError}</Text>
                ) : null}
                <Button
                  title="Invite to household"
                  variant="accent"
                  fullWidth
                  onPress={handleInvite}
                  loading={inviting}
                  disabled={!emailToInvite.trim()}
                />
              </Surface>
            </View>
          )}

          <View>
            <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
              Household Members
            </Text>
            <Surface level="resting" bordered rounded="card" className="overflow-hidden">
              {loading ? (
                <View className="p-6 items-center">
                  <Text className="text-caption text-secondary">Loading members...</Text>
                </View>
              ) : activeMembers.length === 0 ? (
                <View className="p-6 items-center">
                  <Text className="text-caption text-secondary">No members found</Text>
                </View>
              ) : (
                activeMembers.map((m, index) => {
                  const isMe = m.member.user_id === user?.id;
                  const name = getMemberName(m);
                  const email = getMemberEmail(m);
                  const role = m.member.role;

                  return (
                    <View
                      key={m.member.id}
                      className={`flex-row items-center justify-between p-4 ${
                        index < activeMembers.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-10 h-10 rounded-full bg-accent/20 items-center justify-center">
                          <Text className="text-accent font-semibold">
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-body text-primary font-medium" numberOfLines={1}>
                              {name}
                            </Text>
                            {role === "super_admin" && (
                              <View className="bg-yellow-500/20 px-1.5 py-0.5 rounded-sm flex-row items-center gap-1">
                                <Ionicons name="star" size={10} color="#EAB308" />
                                <Text className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">
                                  Owner
                                </Text>
                              </View>
                            )}
                            {role === "admin" && (
                              <View className="bg-blue-500/20 px-1.5 py-0.5 rounded-sm flex-row items-center gap-1">
                                <Ionicons name="shield" size={10} color="#3B82F6" />
                                <Text className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                                  Admin
                                </Text>
                              </View>
                            )}
                            {role === "member" && (
                              <View className="bg-neutral-500/20 px-1.5 py-0.5 rounded-sm flex-row items-center gap-1">
                                <Ionicons name="person" size={10} color="#737373" />
                                <Text className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                  Member
                                </Text>
                              </View>
                            )}
                            {m.member.status === "invited" && (
                              <View className="bg-accent/10 px-1.5 py-0.5 rounded-sm">
                                <Text className="text-[10px] text-accent font-bold uppercase tracking-wider">
                                  Pending
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-caption text-secondary" numberOfLines={1}>
                            {email}
                          </Text>
                        </View>
                      </View>

                      {isOwner && !isMe && m.member.status === "active" && (
                        <View className="flex-row items-center gap-2">
                          <Pressable
                            onPress={() => {
                              setSelectedMember(m);
                              setShowRoleChangeSheet(true);
                            }}
                            hitSlop={8}
                            className="bg-primary/10 p-2 rounded-full"
                          >
                            <Ionicons name="settings-outline" size={18} className="text-primary" />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveMember(m.member.id, name)}
                            hitSlop={8}
                            className="bg-error/10 p-2 rounded-full"
                          >
                            <Ionicons name="trash-outline" size={18} className="text-error" />
                          </Pressable>
                        </View>
                      )}

                      {canInvite && !isMe && m.member.status === "invited" && (
                        <View className="flex-row items-center gap-2">
                          <InviteResendButton
                            member={m.member}
                            onResend={() => handleResend(m.member)}
                          />
                          <Pressable
                            onPress={() => handleRemoveMember(m.member.id, name)}
                            hitSlop={8}
                            className="bg-error/10 p-2 rounded-full"
                          >
                            <Ionicons name="trash-outline" size={18} className="text-error" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </Surface>
          </View>

          <View>
            <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
              Your Households
            </Text>
            <Surface level="resting" bordered rounded="card" className="overflow-hidden">
              {households.map((h, index) => {
                const isDefault = h.household.id === activeHousehold?.household.id;
                return (
                  <View
                    key={h.household.id}
                    className={`flex-row items-center justify-between p-4 ${
                      index < households.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <View className="flex-row items-center gap-3 flex-1 min-w-0">
                      <View className={`w-10 h-10 rounded-full items-center justify-center shrink-0 ${
                        isDefault ? "bg-accent/20" : "bg-surface border border-border"
                      }`}>
                        <Text className={`font-semibold ${isDefault ? "text-accent" : "text-secondary"}`}>
                          {h.household.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-body text-primary font-medium" numberOfLines={1}>
                          {h.household.name}
                        </Text>
                        {isDefault && (
                          <View className="bg-accent/10 px-1.5 py-0.5 rounded-sm self-start mt-1">
                            <Text className="text-[10px] text-accent font-bold uppercase tracking-wider">
                              Default
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {!isDefault && (
                      <Pressable
                        onPress={() => handleSetDefault(h)}
                        hitSlop={8}
                        className="ml-2 bg-accent/10 px-3 py-1.5 rounded-full"
                      >
                        <Text className="text-[12px] text-accent font-semibold">Set default</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {showCreateHousehold ? (
                <View className="p-4 border-t border-border gap-3">
                  <TextInput
                    label="Household name"
                    placeholder="e.g. Family, Work, etc."
                    value={newHouseholdName}
                    onChangeText={setNewHouseholdName}
                  />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        title="Cancel"
                        variant="secondary"
                        fullWidth
                        onPress={() => {
                          setShowCreateHousehold(false);
                          setNewHouseholdName("");
                        }}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Create"
                        variant="accent"
                        fullWidth
                        onPress={handleCreateHousehold}
                        loading={creatingHousehold}
                        disabled={!newHouseholdName.trim()}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowCreateHousehold(true)}
                  className="p-4 border-t border-border flex-row items-center justify-center gap-2"
                >
                  <Ionicons name="add-circle-outline" size={20} className="text-accent" />
                  <Text className="text-body text-accent font-medium">Create new household</Text>
                </Pressable>
              )}
            </Surface>
          </View>

          <View>
            <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
              Leave Household
            </Text>
            <Surface level="resting" bordered rounded="card" className="p-4 gap-3">
              <Text className="text-body text-secondary">
                Remove yourself from "{activeHousehold?.household.name ?? "this household"}". A confirmation link will be emailed to verify it's really you — once confirmed, you lose access to this household's bills.
              </Text>
              <Button
                title="Leave this household"
                variant="destructive"
                fullWidth
                onPress={handleLeaveHousehold}
                loading={leaving}
              />
            </Surface>
          </View>

          {isOwner && (
            <View>
              <Text className="text-caption text-secondary font-medium uppercase tracking-widest mb-2 mt-2">
                Danger Zone
              </Text>
              <Surface level="resting" bordered rounded="card" className="overflow-hidden">
                <View className="p-4 gap-4">
                  <View className="gap-3 border-b border-border pb-4">
                    <Text className="text-body text-secondary">
                      Transfer ownership of this household to another Admin. You will become an Admin.
                    </Text>
                    <Pressable
                      onPress={() => {
                        const otherAdmins = activeMembers.filter(m => m.member.role === "admin" && m.member.status === "active");
                        if (otherAdmins.length === 0) {
                          Alert.alert("No Admins Found", "You must promote a member to Admin before you can transfer ownership to them.");
                          return;
                        }
                        setSelectedMember(otherAdmins[0]);
                        setShowTransferSheet(true);
                      }}
                      className="flex-row items-center justify-between py-3 px-4 bg-accent/5 border border-accent/20 rounded-lg"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className="text-body text-accent font-medium">
                        Transfer Ownership
                      </Text>
                      <Ionicons name="swap-horizontal" size={18} className="text-accent" />
                    </Pressable>
                  </View>
                  <View className="gap-3">
                    <Text className="text-body text-secondary">
                      Delete a non-default household to remove all its bills, members, and data permanently.
                    </Text>
                    {households.filter(h => h.household.id !== activeHousehold?.household.id).map((h) => (
                      <Pressable
                        key={h.household.id}
                        onPress={() => handleDeleteHousehold(h.household.id)}
                        disabled={deleting}
                        className="flex-row items-center justify-between py-3 px-4 bg-error/5 border border-error/20 rounded-lg"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className="text-body text-error font-medium" numberOfLines={1}>
                          Delete "{h.household.name}"
                        </Text>
                        <Ionicons name="trash-outline" size={18} className="text-error" />
                      </Pressable>
                    ))}
                    {households.length === 1 && (
                      <Text className="text-caption text-secondary">
                        You cannot delete your only household.
                      </Text>
                    )}
                  </View>
                </View>
              </Surface>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleChangeSheet
        visible={showRoleChangeSheet}
        onClose={() => setShowRoleChangeSheet(false)}
        targetMember={selectedMember}
        onRoleChange={handleRoleChange}
      />

      <TransferOwnershipSheet
        visible={showTransferSheet}
        onClose={() => setShowTransferSheet(false)}
        householdId={householdId}
        targetMember={selectedMember}
        onSuccess={handleTransferOwnershipSuccess}
      />

      {(deleting || syncing) && (
        <View className="absolute inset-0 z-50 bg-black/70 items-center justify-center">
          <ActivityIndicator size="large" color="#D1A920" />
          <Text className="mt-3 text-white text-[15px] font-semibold">
            {deleting ? "Deleting household…" : "Checking…"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
