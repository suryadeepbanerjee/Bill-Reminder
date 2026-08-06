import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail, Sun, Moon, ChevronRight,
  Share2, Receipt, Info, Shield, FileText, Trash2, LogOut, Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { useProfile, useUpdateProfile } from "../../hooks/useProfile";
import { useHousehold } from "../../hooks/useHousehold";
import { useBills } from "../../hooks/useBills";
import { useTheme } from "../../components/ThemeProvider";
import { useConfirm } from "../../components/ui/Confirm";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import Switch from "../../components/ui/Switch";
import Modal from "../../components/ui/Modal";
import AlertBadge from "../../components/ui/AlertBadge";
import { deleteAccount } from "../../lib/api/household";
import { withCaptcha } from "../../lib/captcha";
import { friendlyError } from "@shared/utils/errors";

/** GitHub mark — lucide dropped brand icons, so inline SVG. */
function GithubIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// ── Section helpers ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary mb-2 mt-6 first:mt-0 px-0.5">
      {children}
    </h3>
  );
}

function SettingsRow({
  icon, title, subtitle, trailing, onClick, showDivider,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  showDivider?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
        showDivider ? "border-b border-border" : ""
      } ${onClick ? "hover:bg-input" : ""}`}
    >
      <span className="text-secondary shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-primary truncate">{title}</span>
        {subtitle && <span className="block text-xs text-secondary truncate">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </Comp>
  );
}

// ── Theme selector ────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
] as const;

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-secondary mb-3">Appearance</p>
      <div className="grid grid-cols-2 gap-2">
        {THEME_OPTIONS.map((opt) => {
          const isActive = theme === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-input transition-all duration-150 ${
                isActive
                  ? "bg-accent/15 border border-accent"
                  : "bg-surface border border-border hover:border-accent/40"
              }`}
            >
              <Icon size={18} className={isActive ? "text-accent" : "text-primary"} />
              <span className={`text-xs font-medium ${isActive ? "text-accent" : "text-secondary"}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Email notifications toggle ───────────────────────────────────────────────

function EmailNotificationsToggle() {
  const { data: profile } = useProfile();
  const { mutateAsync, isPending } = useUpdateProfile();
  const { showToast } = useToast();

  const handleToggle = async () => {
    try {
      await mutateAsync({ email_notifications_enabled: !profile?.email_notifications_enabled });
    } catch {
      showToast("Could not update email preferences", "error");
    }
  };

  return (
    <SettingsRow
      icon={<Mail size={19} />}
      title="Email notifications"
      subtitle="Receive bill reminders via email"
      trailing={
        isPending ? (
          <span className="text-xs text-secondary font-medium">Saving...</span>
        ) : (
          <Switch
            checked={Boolean(profile?.email_notifications_enabled)}
            onChange={handleToggle}
            label="Email notifications"
          />
        )
      }
      onClick={handleToggle}
    />
  );
}

// ── Delete account modal ──────────────────────────────────────────────────────

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, reset } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!open) {
      setStep("confirm");
      setOtp("");
      setError(null);
      setSending(false);
      setVerifying(false);
      setCooldown(0);
    }
  }, [open]);

  const sendOtp = async () => {
    setError(null);
    setSending(true);
    try {
      const { error: otpError } = await withCaptcha((o) =>
        supabase.auth.signInWithOtp({ email: user?.email ?? "", options: o })
      );
      if (otpError) throw otpError;
      setStep("otp");
      setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const verifyAndDelete = async () => {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const { error: verifyError } = await withCaptcha((o) =>
        supabase.auth.verifyOtp({
          email: user?.email ?? "",
          token: otp,
          type: "magiclink",
          options: o,
        })
      );
      if (verifyError) throw verifyError;

      await deleteAccount();
      await supabase.auth.signOut();
      reset();
      navigate("/");
    } catch (e) {
      setError(friendlyError(e));
      setVerifying(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={step === "confirm" ? "Delete account" : "Verify your identity"} size="sm">
      <div className="space-y-4">
        {error && <AlertBadge variant="error">{error}</AlertBadge>}

        {step === "confirm" ? (
          <>
            <div className="bg-error/10 rounded-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Trash2 size={18} className="text-error mt-0.5 shrink-0" />
                <p className="text-sm text-primary leading-relaxed">
                  This will <strong>permanently delete</strong> your account and all data including:
                </p>
              </div>
              <ul className="ml-9 space-y-1.5">
                {["All bills and payment history", "All reminder rules", "Notification preferences", "Push token registrations"].map((item) => (
                  <li key={item} className="text-xs text-secondary">{"\u2022"} {item}</li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-secondary">
              A verification code will be sent to <span className="font-medium text-primary">{user?.email}</span> to confirm this action.
            </p>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
              <Button variant="destructive" fullWidth onClick={sendOtp} loading={sending}>
                Send code
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-secondary">
              Enter the 6-digit code sent to <span className="font-medium text-primary">{user?.email}</span>
            </p>

            <TextInput
              ref={otpRef}
              label="Verification code"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                if (error) setError(null);
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
            />

            <button
              type="button"
              onClick={sendOtp}
              disabled={cooldown > 0}
              className="text-xs font-medium disabled:text-secondary hover:text-accent transition-colors"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" fullWidth onClick={onClose} disabled={verifying}>Cancel</Button>
              <Button
                variant="destructive"
                fullWidth
                onClick={verifyAndDelete}
                loading={verifying}
                disabled={otp.length !== 6}
              >
                Confirm delete
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { activeHousehold } = useHousehold();
  const { data: bills = [] } = useBills();
  const { reset } = useAuthStore();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const displayName = profile?.display_name ?? "Your account";
  const version = "1.0.0";

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out",
      message: "Are you sure you want to sign out?",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (!ok) return;
    try {
      await supabase.auth.signOut();
      reset();
      navigate("/");
    } catch {
      showToast("Could not sign out. Please try again.", "error");
    }
  };

  const handleExport = () => {
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
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bill-reminder-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-primary mb-6">Settings</h1>

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="w-full flex items-center gap-4 px-4 py-4">
          <span className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent text-lg font-semibold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-[15px] font-semibold text-primary truncate">{displayName}</span>
            {profile?.email && <span className="block text-xs text-secondary truncate">{profile.email}</span>}
            {activeHousehold?.household.name && (
              <span className="block text-xs text-secondary truncate">{activeHousehold.household.name}</span>
            )}
          </span>
        </div>
      </div>

      {/* ── Edit profile ───────────────────────────────────────────────── */}
      <SectionHeader>Edit Profile</SectionHeader>
      <div className="bg-surface border border-border rounded-card">
        <SettingsRow
          icon={<Users size={19} />}
          title="Account settings"
          subtitle="Change name, email, or password"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={() => navigate("/app/settings/profile")}
          showDivider
        />
        <SettingsRow
          icon={<Users size={19} />}
          title="Manage household"
          subtitle="Invite members, rename or delete household"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={() => navigate("/app/settings/members")}
        />
      </div>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <SectionHeader>Appearance</SectionHeader>
      <div className="bg-surface border border-border rounded-card">
        <ThemeSelector />
      </div>

      {/* ── Notifications ──────────────────────────────────────────────── */}
      <SectionHeader>Notifications</SectionHeader>
      <div className="bg-surface border border-border rounded-card">
        <SettingsRow
          icon={<Mail size={19} />}
          title="Push notifications"
          subtitle="Available in the mobile app"
          trailing={<span className="text-xs text-secondary font-medium">Mobile</span>}
          showDivider
        />
        <EmailNotificationsToggle />
      </div>

      {/* ── Data ───────────────────────────────────────────────────────── */}
      <SectionHeader>Data</SectionHeader>
      <div className="bg-surface border border-border rounded-card">
        <SettingsRow
          icon={<Share2 size={19} />}
          title="Export data"
          subtitle="Download a JSON snapshot of your bills"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={handleExport}
          showDivider
        />
        <SettingsRow
          icon={<Receipt size={19} />}
          title="Bills tracked"
          trailing={
            <span className="text-[15px] text-secondary font-semibold font-mono tabular-nums">
              {bills.length}
            </span>
          }
        />
      </div>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <SectionHeader>About</SectionHeader>
      <div className="bg-surface border border-border rounded-card">
        <SettingsRow
          icon={<Info size={19} />}
          title="Version"
          trailing={<span className="text-xs text-secondary font-mono tabular-nums">{version}</span>}
          showDivider
        />
        <SettingsRow
          icon={<GithubIcon />}
          title="GitHub"
          subtitle="View source code"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={() => window.open("https://github.com/suryadeepbanerjee/Bill-Reminder", "_blank")}
          showDivider
        />
        <SettingsRow
          icon={<Shield size={19} />}
          title="Privacy policy"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={() => window.open("/privacy", "_blank")}
          showDivider
        />
        <SettingsRow
          icon={<FileText size={19} />}
          title="Terms of service"
          trailing={<ChevronRight size={16} className="text-secondary" />}
          onClick={() => window.open("/terms", "_blank")}
        />
      </div>

      {/* ── Danger zone ────────────────────────────────────────────────── */}
      <div className="pt-6 pb-4 space-y-3">
        <Button variant="secondary" fullWidth onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </Button>
        <Button variant="destructive" fullWidth onClick={() => setShowDeleteModal(true)}>
          <Trash2 size={16} />
          Delete account
        </Button>
      </div>

      <DeleteAccountModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  );
}