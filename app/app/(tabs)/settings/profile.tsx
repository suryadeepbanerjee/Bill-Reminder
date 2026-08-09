import { useState } from "react";
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { useProfile, useUpdateProfile } from "../../../hooks/useProfile";
import { supabase } from "../../../lib/supabase/client";
import { withCaptcha } from "../../../lib/captcha";
import { humanize } from "@shared/utils/errors";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../stores/auth-store";

type Profile = { id: string; display_name: string | null; email: string | null; [k: string]: any };

import { Header } from "../../../components/ui/Header";
import { Surface } from "../../../components/ui/Surface";
import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import { PasswordField } from "../../../components/ui/PasswordField";
import { AlertBadge } from "../../../components/ui/AlertBadge";
import { Modal } from "../../../components/ui/Modal";

// ── Name Section ────────────────────────────────────────────────────────────

function NameSection({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateProfile();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    if (trimmed.length > 50) { setError("Name must be 50 characters or less."); return; }
    setError(null);
    try {
      await mutateAsync({ display_name: trimmed });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Display name updated successfully.");
    } catch (e: any) {
      setError(humanize(e, "unknown"));
    }
  };

  return (
    <Surface level="resting" bordered rounded="card" className="p-4 mb-6">
      <Text className="text-label text-primary font-semibold mb-4">Display Name</Text>
      {error && <View className="mb-4"><AlertBadge message={error} variant="error" /></View>}
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        maxCharacters={50}
        returnKeyType="done"
      />
      <View className="mt-4 items-end">
        <Button 
          title="Update Name" 
          variant="accent" 
          size="sm" 
          onPress={handleSave} 
          loading={isPending}
          disabled={name === currentName}
        />
      </View>
    </Surface>
  );
}

// ── Email Section ───────────────────────────────────────────────────────────

function EmailSection({ profileEmail }: { profileEmail: string | null }) {
  const queryClient = useQueryClient();
  const { user, setSession } = useAuthStore();

  // Auth user email is the source of truth — profiles.email may lag behind
  const currentEmail = user?.email ?? profileEmail ?? "";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpSheet, setShowOtpSheet] = useState(false);
  const [oldOtp, setOldOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [oldEmailVerified, setOldEmailVerified] = useState(false);

  const handleRequestChange = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError("Email cannot be empty."); return; }
    if (!currentEmail) { setError("No current email found."); return; }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      setError("This is already your email.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.updateUser({ email: trimmed });
      if (authError) throw authError;

      // B3.6: do not log the full response — it contains PII (email) and the session
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOtpSheet(true);
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!oldEmailVerified) {
      if (!oldOtp || oldOtp.length < 6) return;
    }
    if (!newOtp || newOtp.length < 6) return;

    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Verify old email OTP
      if (!oldEmailVerified) {
const { error: verifyError } = await withCaptcha("otp_verify", (o) =>
          supabase.auth.verifyOtp({
            email: currentEmail,
            token: oldOtp.trim(),
            type: "email_change",
            options: o,
          })
        );
        if (verifyError) throw verifyError;
        setOldEmailVerified(true);
      }

      // Step 2: Verify new email OTP
const { error: verifyError2 } = await withCaptcha("otp_verify", (o) =>
          supabase.auth.verifyOtp({
          email: email.trim(),
          token: newOtp.trim(),
          type: "email_change",
          options: o,
        })
      );
      if (verifyError2) throw verifyError2;

      // Step 3: Refresh session to pick up the new email from auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
      }

      // Step 4: Update profiles.email so backend templates / edge functions see the new email
      if (user?.id) {
        const { error: profErr } = await supabase
          .from("profiles")
          .update({ email: email.trim() })
          .eq("id", user.id);
        if (profErr) setError(humanize(profErr, "auth"));

        // Immediately update React Query cache so UI reflects new email
        queryClient.setQueryData<Profile | null>(
          ["profile", user.id],
          (old) => old ? { ...old, email: email.trim() } : old
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOtpSheet(false);
      setEmail("");
      setOldOtp("");
      setNewOtp("");
      setOldEmailVerified(false);
      Alert.alert("Success", "Your email has been updated.");
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  const canVerify = oldEmailVerified ? newOtp.length >= 6 : oldOtp.length >= 6 && newOtp.length >= 6;

  return (
    <Surface level="resting" bordered rounded="card" className="p-4 mb-6">
      <Text className="text-label text-primary font-semibold mb-4">Email Address</Text>
      {error && <View className="mb-4"><AlertBadge message={error} variant="error" /></View>}
      
      <Text className="text-body text-secondary mb-4">Current: <Text className="text-primary font-medium">{currentEmail}</Text></Text>
      
      <TextInput
        label="New Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Enter new email address"
      />
      <View className="mt-4 items-end">
        <Button 
          title="Change Email" 
          variant="accent" 
          size="sm" 
          onPress={handleRequestChange} 
          loading={isLoading}
          disabled={!email || email.trim().toLowerCase() === currentEmail.toLowerCase()}
        />
      </View>

      <Modal visible={showOtpSheet} onClose={() => { setShowOtpSheet(false); setOldEmailVerified(false); setOldOtp(""); setNewOtp(""); }} variant="bottom">
        <View className="px-4 pt-4 pb-6 gap-4">
          <Text className="text-title text-primary font-semibold">Verify email change</Text>
          {!oldEmailVerified && (
            <>
              <Text className="text-body text-secondary">
                Enter the 6-digit code sent to <Text className="font-medium text-primary">{currentEmail}</Text>.
              </Text>
              <TextInput
                label="Code sent to current email"
                value={oldOtp}
                onChangeText={setOldOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </>
          )}
          {oldEmailVerified && (
            <Text className="text-body text-success font-medium">Current email verified.</Text>
          )}
          <Text className="text-body text-secondary">
            Enter the 6-digit code sent to <Text className="font-medium text-primary">{email}</Text>.
          </Text>
          {error && <AlertBadge message={error} variant="error" />}
          <TextInput
            label="Code sent to new email"
            value={newOtp}
            onChangeText={setNewOtp}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus={oldEmailVerified}
          />
          <Button 
            title="Verify & Update Email" 
            variant="accent" 
            fullWidth 
            onPress={handleVerifyOtp} 
            loading={isLoading}
            disabled={!canVerify}
          />
        </View>
      </Modal>
    </Surface>
  );
}

// ── Password Section ────────────────────────────────────────────────────────

function PasswordSection({ profileEmail }: { profileEmail: string | null }) {
  const { user } = useAuthStore();
  const email = user?.email ?? profileEmail ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpSheet, setShowOtpSheet] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const handleRequestChange = async () => {
    if (!password) { setError("Password cannot be empty."); return; }
    if (password.length <= 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await withCaptcha("recover", (o) =>
        supabase.auth.resetPasswordForEmail(email, o)
      );
      if (authError) throw authError;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOtpSheet(true);
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndUpdate = async () => {
    if (!otp || otp.length < 6) return;
    setIsLoading(true);
    setError(null);
    try {
      if (!isOtpVerified) {
const { error: verifyError } = await withCaptcha("otp_verify", (o) =>
          supabase.auth.verifyOtp({
            email: email,
            token: otp.trim(),
            type: "recovery",
            options: o,
          })
        );
        if (verifyError) throw verifyError;
        
        setIsOtpVerified(true);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOtpSheet(false);
      setPassword("");
      setConfirm("");
      setOtp("");
      setIsOtpVerified(false);
      Alert.alert("Success", "Your password has been changed.");
    } catch (e: any) {
      setError(humanize(e, "auth"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Surface level="resting" bordered rounded="card" className="p-4 mb-6">
      <Text className="text-label text-primary font-semibold mb-4">Password</Text>
      {error && <View className="mb-4"><AlertBadge message={error} variant="error" /></View>}
      
      <View className="gap-3">
        <PasswordField
          label="New Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter new password"
        />
        <PasswordField
          label="Confirm Password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm new password"
        />
      </View>

      <View className="mt-4 items-end">
        <Button 
          title="Change Password" 
          variant="accent" 
          size="sm" 
          onPress={handleRequestChange} 
          loading={isLoading}
          disabled={!password || !confirm}
        />
      </View>

      <Modal visible={showOtpSheet} onClose={() => { setShowOtpSheet(false); setIsOtpVerified(false); setOtp(""); }} variant="bottom">
        <View className="px-4 pt-4 pb-6 gap-4">
          <Text className="text-title text-primary font-semibold">Verify password change</Text>
          <Text className="text-body text-secondary">
            Enter the 6-digit code sent to <Text className="font-medium text-primary">{email}</Text>.
          </Text>
          {error && <AlertBadge message={error} variant="error" />}
          <TextInput
            label="Verification Code"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <Button 
            title="Verify & Update Password" 
            variant="accent" 
            fullWidth 
            onPress={handleVerifyAndUpdate} 
            loading={isLoading}
            disabled={otp.length < 6}
          />
        </View>
      </Modal>
    </Surface>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { data: profile } = useProfile();

  if (!profile) return null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Header title="Edit Profile" showBack />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <NameSection currentName={profile.display_name ?? ""} />
          <EmailSection profileEmail={profile.email} />
          <PasswordSection profileEmail={profile.email} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
