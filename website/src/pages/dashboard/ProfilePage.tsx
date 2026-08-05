import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useProfile, useUpdateProfile } from "../../hooks/useProfile";
import { useAuthStore } from "../../stores/auth-store";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import Modal from "../../components/ui/Modal";
import AlertBadge from "../../components/ui/AlertBadge";
import { useToast } from "../../components/ui/Toast";
import { friendlyError } from "../../lib/errors";
import type { Profile } from "../../lib/types";

function Header() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-1 mb-6">
      <button
        type="button"
        onClick={() => navigate("/app/settings")}
        aria-label="Go back"
        className="p-2 -ml-2 rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Edit Profile</h1>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-card p-4 mb-6">
      <h2 className="text-[15px] font-semibold text-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

// ── Display name ──────────────────────────────────────────────────────────────

function NameSection({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateProfile();
  const { showToast } = useToast();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    if (trimmed.length > 50) { setError("Name must be 50 characters or less."); return; }
    setError(null);
    try {
      await mutateAsync({ display_name: trimmed });
      showToast("Display name updated", "success");
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Section title="Display Name">
      {error && <div className="mb-4"><AlertBadge variant="error">{error}</AlertBadge></div>}
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
        maxCharacters={50}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
      />
      <div className="flex justify-end">
        <Button variant="accent" size="sm" onClick={handleSave} loading={isPending} disabled={name.trim() === currentName}>
          Update Name
        </Button>
      </div>
    </Section>
  );
}

// ── Email ─────────────────────────────────────────────────────────────────────

function EmailSection({ profileEmail }: { profileEmail: string | null }) {
  const queryClient = useQueryClient();
  const { user, setSession } = useAuthStore();
  const { showToast } = useToast();

  const currentEmail = user?.email ?? profileEmail ?? "";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
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
      const { error: authError } = await supabase.auth.updateUser({ email: trimmed });
      if (authError) throw authError;
      setShowOtpModal(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!oldEmailVerified && (!oldOtp || oldOtp.length < 6)) return;
    if (!newOtp || newOtp.length < 6) return;

    setIsLoading(true);
    setError(null);
    try {
      if (!oldEmailVerified) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: currentEmail,
          token: oldOtp.trim(),
          type: "email_change",
        });
        if (verifyError) throw verifyError;
        setOldEmailVerified(true);
      }

      const { error: verifyError2 } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: newOtp.trim(),
        type: "email_change",
      });
      if (verifyError2) throw verifyError2;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) setSession(session);

      if (user?.id) {
        await supabase.from("profiles").update({ email: email.trim() }).eq("id", user.id);
        queryClient.setQueryData<Profile | null>(
          ["profile", user.id],
          (old) => (old ? { ...old, email: email.trim() } : old)
        );
      }

      setShowOtpModal(false);
      setEmail("");
      setOldOtp("");
      setNewOtp("");
      setOldEmailVerified(false);
      showToast("Your email has been updated", "success");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const canVerify = oldEmailVerified ? newOtp.length >= 6 : oldOtp.length >= 6 && newOtp.length >= 6;

  return (
    <Section title="Email Address">
      {error && <div className="mb-4"><AlertBadge variant="error">{error}</AlertBadge></div>}
      <p className="text-sm text-secondary mb-4">
        Current: <span className="text-primary font-medium">{currentEmail}</span>
      </p>
      <TextInput
        label="New Email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
        type="email"
        placeholder="Enter new email address"
      />
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="sm"
          onClick={handleRequestChange}
          loading={isLoading}
          disabled={!email || email.trim().toLowerCase() === currentEmail.toLowerCase()}
        >
          Change Email
        </Button>
      </div>

      <Modal open={showOtpModal} onClose={() => { setShowOtpModal(false); setOldEmailVerified(false); setOldOtp(""); setNewOtp(""); }} title="Verify email change" size="sm">
        <div className="space-y-4">
          {!oldEmailVerified && (
            <>
              <p className="text-sm text-secondary">
                Enter the 6-digit code sent to <span className="font-medium text-primary">{currentEmail}</span>.
              </p>
              <TextInput
                label="Code sent to current email"
                value={oldOtp}
                onChange={(e) => setOldOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
            </>
          )}
          {oldEmailVerified && (
            <p className="text-sm text-success font-medium">Current email verified.</p>
          )}
          <p className="text-sm text-secondary">
            Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span>.
          </p>
          {error && <AlertBadge variant="error">{error}</AlertBadge>}
          <TextInput
            label="Code sent to new email"
            value={newOtp}
            onChange={(e) => setNewOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            autoFocus={oldEmailVerified}
          />
          <Button
            variant="accent"
            fullWidth
            onClick={handleVerifyOtp}
            loading={isLoading}
            disabled={!canVerify}
          >
            Verify &amp; Update Email
          </Button>
        </div>
      </Modal>
    </Section>
  );
}

// ── Password ──────────────────────────────────────────────────────────────────

function PasswordSection({ profileEmail }: { profileEmail: string | null }) {
  const { user } = useAuthStore();
  const email = user?.email ?? profileEmail ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const { showToast } = useToast();

  const handleRequestChange = async () => {
    if (!password) { setError("Password cannot be empty."); return; }
    if (password.length <= 12) { setError("Password must be greater than 12 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
      if (authError) throw authError;
      setShowOtpModal(true);
    } catch (e) {
      setError(friendlyError(e));
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
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: "recovery",
        });
        if (verifyError) throw verifyError;
        setIsOtpVerified(true);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setShowOtpModal(false);
      setPassword("");
      setConfirm("");
      setOtp("");
      setIsOtpVerified(false);
      showToast("Your password has been changed", "success");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Section title="Password">
      {error && <div className="mb-4"><AlertBadge variant="error">{error}</AlertBadge></div>}
      <TextInput
        label="New Password"
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
        placeholder="Enter new password"
      />
      <TextInput
        label="Confirm Password"
        type="password"
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); if (error) setError(null); }}
        placeholder="Confirm new password"
      />
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="sm"
          onClick={handleRequestChange}
          loading={isLoading}
          disabled={!password || !confirm}
        >
          Change Password
        </Button>
      </div>

      <Modal open={showOtpModal} onClose={() => { setShowOtpModal(false); setIsOtpVerified(false); setOtp(""); }} title="Verify password change" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span>.
          </p>
          {error && <AlertBadge variant="error">{error}</AlertBadge>}
          <TextInput
            label="Verification Code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />
          <Button
            variant="accent"
            fullWidth
            onClick={handleVerifyAndUpdate}
            loading={isLoading}
            disabled={otp.length < 6}
          >
            Verify &amp; Update Password
          </Button>
        </div>
      </Modal>
    </Section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: profile } = useProfile();

  if (!profile) return null;

  return (
    <div className="max-w-xl mx-auto">
      <Header />
      <NameSection currentName={profile.display_name ?? ""} />
      <EmailSection profileEmail={profile.email} />
      <PasswordSection profileEmail={profile.email} />
    </div>
  );
}