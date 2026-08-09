import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Plus, Trash2, Shield, User, CheckCircle2, AlertCircle, Settings, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { useHouseholdStore } from "../../stores/household-store";
import {
  fetchHouseholdMembers,
  ensureAtLeastOneHousehold,
  inviteToHousehold,
  leaveToHousehold,
  membershipExists,
  removeMember,
  setMemberRole,
  renameHousehold,
  deleteHousehold,
  createHousehold,
  transferOwnershipRequest,
  transferOwnershipConfirm,
} from "../../lib/api/household";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { useConfirm } from "../../components/ui/Confirm";
import { InviteResendButton } from "../../components/household/InviteResendButton";
import { useToast } from "../../components/ui/Toast";
import Modal from "../../components/ui/Modal";
import { friendlyError } from "@shared/utils/errors";
import {
  canInviteMembers,
  canManageHousehold,
  isSuperAdmin,
  roleLabel,
} from "@shared/utils/roles";
import type { HouseholdMember, Profile } from "@shared/types";

const INVITE_EXPIRY_HOURS = 1;
const REINVITE_COOLDOWN_HOURS = 1;

/** When the invite link stops working — measured from the LAST send. */
function inviteSentAt(m: { created_at: string; invite_last_sent_at?: string | null }): number {
  return new Date(m.invite_last_sent_at ?? m.created_at).getTime();
}

function isInviteExpired(m: { created_at: string; invite_last_sent_at?: string | null }): boolean {
  return (Date.now() - inviteSentAt(m)) / (1000 * 60 * 60) > INVITE_EXPIRY_HOURS;
}

function isInviteWithinCooldown(m: { created_at: string; invite_last_sent_at?: string | null }): boolean {
  return (Date.now() - inviteSentAt(m)) / (1000 * 60 * 60) < REINVITE_COOLDOWN_HOURS;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary mb-2 mt-6 first:mt-0 px-0.5">
      {children}
    </h3>
  );
}

type MemberRow = { member: HouseholdMember; profile: Profile | null };

function getMemberName(m: MemberRow): string {
  return m.profile?.display_name ?? m.member.invited_email?.split("@")[0] ?? "Unknown";
}

function getMemberEmail(m: MemberRow): string {
  return m.profile?.email ?? m.member.invited_email ?? "";
}

export default function MembersPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeHousehold = useHouseholdStore((s) => s.activeHousehold);
  const setActiveHousehold = useHouseholdStore((s) => s.setActiveHousehold);
  const defaultHouseholdId = useHouseholdStore((s) => s.defaultHouseholdId);
  const setDefaultHousehold = useHouseholdStore((s) => s.setDefaultHousehold);
  const setHouseholds = useHouseholdStore((s) => s.setHouseholds);
  const households = useHouseholdStore((s) => s.households);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [emailToInvite, setEmailToInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [creatingHousehold, setCreatingHousehold] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferStep, setTransferStep] = useState<"confirm" | "otp">("confirm");
  const [transferOtp, setTransferOtp] = useState("");
  const [transferSending, setTransferSending] = useState(false);
  const [transferVerifying, setTransferVerifying] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferCooldown, setTransferCooldown] = useState(0);
  const [showTransferSelectModal, setShowTransferSelectModal] = useState(false);

  const [showDeleteHouseholdModal, setShowDeleteHouseholdModal] = useState(false);
  const [householdToDelete, setHouseholdToDelete]               = useState<string | null>(null);
  const [deleteHouseholdStep, setDeleteHouseholdStep]           = useState<"confirm" | "otp">("confirm");
  const [deleteHouseholdOtp, setDeleteHouseholdOtp]             = useState("");
  const [deleteHouseholdError, setDeleteHouseholdError]         = useState<string | null>(null);
  const [deleteHouseholdSending, setDeleteHouseholdSending]     = useState(false);
  const [deleteHouseholdVerifying, setDeleteHouseholdVerifying] = useState(false);
  const [deleteHouseholdCooldown, setDeleteHouseholdCooldown]   = useState(0);

  const householdId = activeHousehold?.household.id ?? "";
  const myRole = activeHousehold?.member.role ?? null;
  const isSuper = canManageHousehold(myRole);
  const canInvite = canInviteMembers(myRole);

  const loadMembers = useCallback(async (hhId: string) => {
    setLoading(true);
    try {
      setMembers(await fetchHouseholdMembers(hhId));
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHouseholds = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await ensureAtLeastOneHousehold(user.id);
      setHouseholds(list);
      queryClient.invalidateQueries({ queryKey: ["households", user?.id] });
      const activeId = activeHousehold?.household.id;
      if (!list.some((h) => h.household.id === activeId)) {
        setActiveHousehold(list[0]);
      }
    } catch {
    }
  }, [user?.id, activeHousehold?.household.id, setHouseholds, setActiveHousehold, queryClient]);

  useEffect(() => {
    if (!householdId) return;
    loadMembers(householdId);
  }, [householdId, loadMembers]);

  useEffect(() => {
    if (transferCooldown <= 0) return;
    const timer = setTimeout(() => setTransferCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [transferCooldown]);

  useEffect(() => {
    if (deleteHouseholdCooldown <= 0) return;
    const timer = setTimeout(() => setDeleteHouseholdCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [deleteHouseholdCooldown]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    // Re-evaluate invite expiry every minute so pending badges disappear on
    // their own shortly after the 1-hour link expiry.
    const timer = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const activeMembers = useMemo(
    () =>
      members.filter((m) => {
        if (m.member.status !== "invited") return true;
        return !isInviteExpired(m.member);
      }),
    [members, nowTick]
  );

  const handleInvite = async () => {
    setInviteError(null);
    const email = emailToInvite.trim().toLowerCase();
    if (!email) { setInviteError("Please enter an email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInviteError("Please enter a valid email address."); return; }
    if (!householdId) return;

    const recentInvite = members.find(
      (m) => m.member.status === "invited" && m.member.invited_email === email
    );
    if (recentInvite && isInviteWithinCooldown(recentInvite.member)) {
      const hoursElapsed = (Date.now() - inviteSentAt(recentInvite.member)) / (1000 * 60 * 60);
      const hoursLeft = Math.ceil(REINVITE_COOLDOWN_HOURS - hoursElapsed);
      setInviteError(`This email was already invited. Please wait ${hoursLeft}h before re-inviting.`);
      return;
    }

    setInviting(true);
    try {
      await inviteToHousehold(householdId, email);
      showToast(`Invitation sent to ${email}`, "success");
      setEmailToInvite("");
      await loadMembers(householdId);
    } catch (e) {
      setInviteError(friendlyError(e));
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (member: HouseholdMember) => {
    const email = member.invited_email ?? "";
    if (!email || !householdId) return;
    setResending(true);
    try {
      try {
        await inviteToHousehold(householdId, email);
        showToast(`Invitation sent to ${email}`, "success");
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e ?? "");
        if (/already a member/i.test(raw)) {
          showToast("This person has already joined the household.", "info");
        } else {
          showToast(friendlyError(e), "error");
        }
      }
      await loadMembers(householdId);
    } finally {
      setResending(false);
    }
  };

  const handleLeaveHousehold = async () => {
    if (!householdId || !user?.id) return;

    setSyncing(true);
    try {
      const { exists, status } = await membershipExists(householdId, user.id);
      if (!exists || status !== "active") {
        await refreshHouseholds();
        setSyncing(false);
        showToast("You've already left this household.", "info");
        return;
      }
    } catch (e) {
      setSyncing(false);
      showToast(friendlyError(e), "error");
      return;
    }
    setSyncing(false);

    const confirmed = await confirm({
      title: "Leave this household?",
      message: `We'll email a confirmation link to verify it's really you. Once confirmed, you will lose access to "${activeHousehold?.household.name ?? "this household"}" and its bills.`,
      confirmLabel: "Send link",
      destructive: true,
    });
    
    if (confirmed) {
      setLeaving(true);
      try {
        const res = await leaveToHousehold(householdId);
        showToast(res.message ?? "Check your inbox for a confirmation link.", "success");
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e ?? "");
        if (/not an active member|already left/i.test(raw)) {
          await refreshHouseholds();
          showToast("You've already left this household.", "info");
        } else {
          showToast(friendlyError(e), "error");
        }
      } finally {
        setLeaving(false);
      }
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!householdId) return;
    const confirmed = await confirm({
      title: "Remove Member",
      message: `Are you sure you want to remove ${memberName} from the household?`,
      confirmLabel: "Remove",
      destructive: true,
    });
    
    if (confirmed) {
      setSyncing(true);
      try {
        const fresh = await fetchHouseholdMembers(householdId);
        if (!fresh.some(m => m.member.id === memberId)) {
          setMembers(fresh);
          setSyncing(false);
          showToast(`${memberName} has already been removed.`, "info");
          return;
        }
        setSyncing(false);
        await removeMember(memberId);
        setMembers((prev) => prev.filter((m) => m.member.id !== memberId));
        showToast(`${memberName} removed.`, "success");
      } catch (e) {
        setSyncing(false);
        const raw = e instanceof Error ? e.message : String(e ?? "");
        if (/no rows? updated|already been removed|not found/i.test(raw)) {
          await loadMembers(householdId);
          showToast(`${memberName} has already been removed.`, "info");
        } else {
          showToast(friendlyError(e), "error");
        }
      }
    }
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
        if (match) setActiveHousehold(match);
      }
      showToast("Household renamed", "success");
      setShowRename(false);
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setRenaming(false);
    }
  };

  const handleSendDeleteHouseholdOtp = async () => {
    setDeleteHouseholdError(null);
    setDeleteHouseholdSending(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: user?.email ?? "" });
      if (otpError) throw otpError;
      setDeleteHouseholdStep("otp");
      setDeleteHouseholdCooldown(60);
    } catch (e: any) {
      setDeleteHouseholdError(friendlyError(e));
    } finally {
      setDeleteHouseholdSending(false);
    }
  };

  const handleResendDeleteHouseholdOtp = async () => {
    if (deleteHouseholdCooldown > 0) return;
    setDeleteHouseholdError(null);
    setDeleteHouseholdSending(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: user?.email ?? "" });
      if (otpError) throw otpError;
      setDeleteHouseholdCooldown(60);
    } catch (e: any) {
      setDeleteHouseholdError(friendlyError(e));
    } finally {
      setDeleteHouseholdSending(false);
    }
  };

  const handleVerifyAndDeleteHousehold = async () => {
    if (deleteHouseholdOtp.length !== 6) {
      setDeleteHouseholdError("Please enter the 6-digit code.");
      return;
    }
    if (!householdToDelete) return;

    setDeleteHouseholdError(null);
    setDeleteHouseholdVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user?.email ?? "",
        token: deleteHouseholdOtp,
        type: "magiclink",
      });
      if (verifyError) throw verifyError;

      await deleteHousehold(householdToDelete);
      
      const remaining = households.filter((h) => h.household.id !== householdToDelete);
      setHouseholds(remaining);
      if (activeHousehold?.household.id === householdToDelete && remaining.length > 0) {
        useHouseholdStore.getState().setActiveHousehold(remaining[0]);
      }
      queryClient.invalidateQueries({ queryKey: ["households", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["bills", householdToDelete] });
      showToast("Household deleted successfully", "success");
      
      setShowDeleteHouseholdModal(false);
      setTimeout(() => {
        setDeleteHouseholdStep("confirm");
        setDeleteHouseholdOtp("");
        setDeleteHouseholdError(null);
        setHouseholdToDelete(null);
      }, 200);

    } catch (e: any) {
      setDeleteHouseholdError(friendlyError(e));
    } finally {
      setDeleteHouseholdVerifying(false);
    }
  };

  const handleDeleteHousehold = async (targetId: string) => {
    const target = households.find((h) => h.household.id === targetId);
    if (!target) return;
    if (households.length <= 1) {
      showToast("You cannot delete your only household.", "error");
      return;
    }
    if (target.member.role !== "super_admin") {
      showToast(`You do not have permission to delete "${target.household.name}".`, "error");
      return;
    }
    setHouseholdToDelete(targetId);
    setShowDeleteHouseholdModal(true);
  };

  const handleCreateHousehold = async () => {
    const name = newHouseholdName.trim();
    if (!name || !user?.id) return;
    setCreatingHousehold(true);
    try {
      const result = await createHousehold(name, user.id);
      const newList = [...households, result];
      setHouseholds(newList);
      setActiveHousehold(result);
      setShowCreateHousehold(false);
      setNewHouseholdName("");
      showToast(`Household "${name}" created`, "success");
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setCreatingHousehold(false);
    }
  };

  const handleSendTransferOtp = async () => {
    if (!selectedMember) return;
    setTransferError(null);
    setTransferSending(true);
    try {
      await transferOwnershipRequest(householdId, selectedMember.member.id);
      setTransferStep("otp");
      setTransferCooldown(60);
    } catch (e: any) {
      setTransferError(friendlyError(e));
    } finally {
      setTransferSending(false);
    }
  };

  const handleResendTransferOtp = async () => {
    if (transferCooldown > 0 || !selectedMember) return;
    setTransferError(null);
    setTransferSending(true);
    try {
      await transferOwnershipRequest(householdId, selectedMember.member.id);
      setTransferCooldown(60);
    } catch (e: any) {
      setTransferError(friendlyError(e));
    } finally {
      setTransferSending(false);
    }
  };

  const handleVerifyTransfer = async () => {
    if (transferOtp.length !== 6 || !selectedMember) {
      setTransferError("Please enter the 6-digit code.");
      return;
    }
    setTransferError(null);
    setTransferVerifying(true);
    try {
      await transferOwnershipConfirm(householdId, selectedMember.member.id, transferOtp);
      showToast("Ownership Transferred successfully.", "success");
      setShowTransferModal(false);
      setTransferStep("confirm");
      setTransferOtp("");
      await loadMembers(householdId);
      await refreshHouseholds();
    } catch (e: any) {
      setTransferError(friendlyError(e));
      setTransferVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-input transition-colors shrink-0"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Manage Household</h1>
      </div>

      {/* ── Household Name ─────────────────────────────────────────────── */}
      {isSuper && (
        <>
          <SectionHeader>Household Name</SectionHeader>
          <div className="bg-surface border border-border rounded-card p-4 space-y-4">
            {showRename ? (
              <div className="space-y-3">
                <TextInput
                  label="Household name"
                  placeholder="Enter new name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                  autoFocus
                />
                <div className="flex gap-3">
                  <Button variant="secondary" fullWidth onClick={() => setShowRename(false)}>
                    Cancel
                  </Button>
                  <Button variant="accent" fullWidth onClick={handleRename} loading={renaming} disabled={!renameValue.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setRenameValue(activeHousehold?.household.name ?? ""); setShowRename(true); }}
                className="w-full flex items-center justify-between text-left group"
              >
                <span className="text-sm text-primary group-hover:text-accent transition-colors">
                  {activeHousehold?.household.name ?? "Household"}
                </span>
                <Pencil size={16} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Invite Members ─────────────────────────────────────────────── */}
      {canInvite && (
        <>
          <SectionHeader>Invite a user</SectionHeader>
          <div className="bg-surface border border-border rounded-card p-4 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">
              Send an invitation link to a user. Once they accept, they will be able to see and manage bills in this household.
            </p>
            <div className="space-y-1">
              <TextInput
                label="Email address"
                placeholder="user@example.com"
                type="email"
                value={emailToInvite}
                onChange={(e) => setEmailToInvite(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              />
              {inviteError && <p className="text-[11px] text-error font-medium pl-1 mt-1">{inviteError}</p>}
            </div>
            <Button
              variant="accent"
              fullWidth
              onClick={handleInvite}
              loading={inviting}
              disabled={!emailToInvite.trim()}
            >
              Invite to household
            </Button>
          </div>
        </>
      )}

      {/* ── Household Members ──────────────────────────────────────────── */}
      <SectionHeader>Household Members</SectionHeader>
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {loading ? (
          <div className="py-6 text-center">
            <p className="text-xs text-secondary">Loading members...</p>
          </div>
        ) : activeMembers.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-secondary">No members found</p>
          </div>
        ) : (
          activeMembers.map((m, index) => {
            const isMe = m.member.user_id === user?.id;
            const name = getMemberName(m);
            const email = getMemberEmail(m);
            const role = m.member.role;

            return (
              <div
                key={m.member.id}
                className={`flex items-center justify-between p-4 ${
                  index < activeMembers.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-primary font-medium truncate">{name}</span>
                      {role === "super_admin" && (
                        <span className="bg-yellow-500/10 px-1.5 py-0.5 rounded-sm text-[10px] text-yellow-600 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 border border-yellow-500/20">
                          Owner
                        </span>
                      )}
                      {role === "admin" && (
                        <span className="bg-blue-500/10 px-1.5 py-0.5 rounded-sm text-[10px] text-blue-600 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 border border-blue-500/20">
                          Admin
                        </span>
                      )}
                      {role === "member" && (
                        <span className="bg-neutral-500/10 px-1.5 py-0.5 rounded-sm text-[10px] text-neutral-500 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 border border-neutral-500/20">
                          Member
                        </span>
                      )}
                      {m.member.status === "invited" && (
                        <span className="bg-accent/10 px-1.5 py-0.5 rounded-sm text-[10px] text-accent font-bold uppercase tracking-wider shrink-0">
                          Pending
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] text-secondary font-medium shrink-0">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-secondary truncate">{email}</p>
                  </div>
                </div>

                {isSuper && !isMe && m.member.status === "active" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Change role for ${name}`}
                      onClick={() => { setSelectedMember(m); setShowRoleModal(true); }}
                      className="bg-primary/10 p-2 rounded-full text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => handleRemoveMember(m.member.id, name)}
                      className="bg-error/10 p-2 rounded-full text-error hover:bg-error/20 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {canInvite && !isMe && m.member.status === "invited" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <InviteResendButton
                      member={m.member}
                      onResend={() => handleResend(m.member)}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => handleRemoveMember(m.member.id, name)}
                      className="bg-error/10 p-2 rounded-full text-error hover:bg-error/20 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Your households ────────────────────────────────────────────── */}
      <SectionHeader>Your Households</SectionHeader>
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {households.map((h, index) => {
          const isDefault = h.household.id === defaultHouseholdId;
          return (
            <div
              key={h.household.id}
              className={`flex items-center justify-between p-4 ${
                index < households.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold shrink-0 ${
                  isDefault ? "bg-accent/20 text-accent" : "bg-surface border border-border text-secondary"
                }`}>
                  {h.household.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary font-medium truncate">{h.household.name}</p>
                  {isDefault && (
                    <span className="bg-accent/10 px-1.5 py-0.5 rounded-sm text-[10px] text-accent font-bold uppercase tracking-wider self-start mt-1 inline-block">
                      Default
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultHousehold(h)}
                    className="bg-accent/10 px-3 py-1.5 rounded-full text-xs text-accent font-semibold hover:bg-accent/20 transition-colors shrink-0"
                  >
                    Set default
                  </button>
                )}
                {isSuperAdmin(h.member.role) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteHousehold(h.household.id)}
                    className="p-1.5 text-secondary hover:text-error hover:bg-error/10 rounded-md transition-colors shrink-0"
                    title="Delete household"
                    disabled={deleting}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {showCreateHousehold ? (
          <div className="p-4 border-t border-border space-y-3">
            <TextInput
              label="Household name"
              placeholder="e.g. Family, Work, etc."
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateHousehold(); }}
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => { setShowCreateHousehold(false); setNewHouseholdName(""); }}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                fullWidth
                onClick={handleCreateHousehold}
                loading={creatingHousehold}
                disabled={!newHouseholdName.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateHousehold(true)}
            className="w-full p-4 border-t border-border flex items-center justify-center gap-2 text-accent hover:bg-input transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">Create new household</span>
          </button>
        )}
      </div>

      {/* ── Leave this household ────────────────────────────────────────── */}
      {!isSuper && (
        <>
          <SectionHeader>Leave household</SectionHeader>
          <div className="bg-surface border border-border rounded-card p-4 space-y-3">
            <p className="text-sm text-secondary leading-relaxed">
              Remove yourself from "{activeHousehold?.household.name ?? "this household"}". A confirmation link will be emailed to verify it's really you — once confirmed, you lose access to this household's bills.
            </p>
            <Button
              variant="destructive"
              fullWidth
              onClick={handleLeaveHousehold}
              loading={leaving}
            >
              Leave this household
            </Button>
          </div>
        </>
      )}

      {/* ── Danger zone ────────────────────────────────────────────────── */}
      {isSuper && (
        <>
          <SectionHeader>Danger Zone</SectionHeader>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="space-y-3 border-b border-border pb-4">
                <p className="text-sm text-secondary">
                  Transfer ownership of this household to another Admin. You will become an Admin.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const otherAdmins = activeMembers.filter(m => m.member.role === "admin" && m.member.status === "active");
                    if (otherAdmins.length === 0) {
                      showToast("You must promote a member to Admin before you can transfer ownership.", "error");
                      return;
                    }
                    setShowTransferSelectModal(true);
                  }}
                  className="w-full flex items-center justify-between py-3 px-4 bg-accent/15 rounded-lg text-accent hover:bg-accent/25 transition-colors"
                >
                  <span className="text-sm font-medium">Transfer Ownership</span>
                </button>
              </div>

              <div className="space-y-3 pt-2 border-b border-border pb-4">
                <p className="text-sm text-secondary">
                  Remove yourself from this household. 
                </p>
                <button
                  type="button"
                  onClick={() => {
                    showToast("As the Owner, you must transfer ownership to another Admin before you can leave. Alternatively, you can delete the household using the trash icon in Your Households.", "error");
                  }}
                  className="w-full flex items-center justify-between py-3 px-4 bg-error/5 rounded-lg text-error hover:bg-error/10 transition-colors"
                >
                  <span className="text-sm font-medium">Leave Household</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Transfer Ownership Selection Modal ───────────────────────────────────── */}
      <Modal
        open={showTransferSelectModal}
        onClose={() => setShowTransferSelectModal(false)}
        title="Select New Owner"
      >
        <div className="space-y-3 mt-4">
          <p className="text-sm text-secondary mb-4">
            Select an Admin to transfer ownership to:
          </p>
          {activeMembers.filter(m => m.member.role === "admin" && m.member.status === "active").map(admin => (
            <button
              key={admin.member.id}
              onClick={() => {
                setSelectedMember(admin);
                setShowTransferSelectModal(false);
                setShowTransferModal(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:border-accent/40 transition-colors text-left"
            >
              <div>
                <span className="block text-sm font-medium text-primary">{getMemberName(admin)}</span>
                <span className="block text-xs text-secondary">{getMemberEmail(admin)}</span>
              </div>
              <ChevronRight size={18} className="text-secondary" />
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Transfer Ownership Modal ───────────────────────────────────── */}
      <Modal
        open={showTransferModal}
        onClose={() => {
          if (transferVerifying) return;
          setShowTransferModal(false);
          setTimeout(() => {
            setTransferStep("confirm");
            setTransferOtp("");
            setTransferError(null);
          }, 200);
        }}
        title={transferStep === "confirm" ? "Transfer Ownership" : "Verify your identity"}
        dismissable={transferStep === "confirm" && !transferVerifying}
        footer={
          transferStep === "confirm" ? (
            <>
              <Button variant="secondary" onClick={() => setShowTransferModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="accent" onClick={handleSendTransferOtp} loading={transferSending} className="flex-1">
                Send code
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowTransferModal(false)} className="flex-1" disabled={transferVerifying}>
                Cancel
              </Button>
              <Button variant="accent" onClick={handleVerifyTransfer} loading={transferVerifying} disabled={transferOtp.length !== 6} className="flex-1">
                Confirm Transfer
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {transferError && (
            <div className="bg-error/10 text-error px-3 py-2 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          {transferStep === "confirm" ? (
            <>
              <div className="bg-accent/10 p-4 rounded-lg space-y-2 border border-accent/20">
                <div className="flex items-start gap-2 text-primary">
                  <AlertCircle size={18} className="text-accent mt-0.5 shrink-0" />
                  <p className="text-sm leading-relaxed">
                    You are about to transfer ownership to <span className="font-semibold">{selectedMember ? getMemberName(selectedMember) : ""}</span>.
                  </p>
                </div>
                <ul className="text-xs text-secondary list-disc ml-8 space-y-1">
                  <li>They will become the Owner.</li>
                  <li>You will be downgraded to an Admin.</li>
                  <li>This action cannot be undone.</li>
                </ul>
              </div>
              <p className="text-sm text-secondary">
                A verification code will be sent to <span className="font-medium text-primary">{user?.email}</span> to confirm this action.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-secondary">
                Enter the 6-digit code sent to <span className="font-medium text-primary">{user?.email}</span>
              </p>
              <TextInput
                label="Verification code"
                placeholder="000000"
                value={transferOtp}
                onChange={(e) => {
                  setTransferOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                  if (transferError) setTransferError(null);
                }}
                maxLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={handleResendTransferOtp}
                disabled={transferCooldown > 0}
                className={`text-xs font-medium ${transferCooldown > 0 ? "text-secondary cursor-not-allowed" : "text-primary hover:text-accent"} transition-colors`}
              >
                {transferCooldown > 0 ? `Resend code in ${transferCooldown}s` : "Resend code"}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* ── Delete Household Modal ───────────────────────────────────── */}
      <Modal
        open={showDeleteHouseholdModal}
        onClose={() => {
          if (deleteHouseholdVerifying) return;
          setShowDeleteHouseholdModal(false);
          setTimeout(() => {
            setDeleteHouseholdStep("confirm");
            setDeleteHouseholdOtp("");
            setDeleteHouseholdError(null);
            setHouseholdToDelete(null);
          }, 200);
        }}
        title={deleteHouseholdStep === "confirm" ? "Delete Household" : "Verify your identity"}
        dismissable={deleteHouseholdStep === "confirm" && !deleteHouseholdVerifying}
        footer={
          deleteHouseholdStep === "confirm" ? (
            <>
              <Button variant="secondary" onClick={() => setShowDeleteHouseholdModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSendDeleteHouseholdOtp} loading={deleteHouseholdSending} className="flex-1">
                Send code
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowDeleteHouseholdModal(false)} className="flex-1" disabled={deleteHouseholdVerifying}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleVerifyAndDeleteHousehold} loading={deleteHouseholdVerifying} disabled={deleteHouseholdOtp.length !== 6} className="flex-1">
                Delete Household
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {deleteHouseholdError && (
            <div className="bg-error/10 text-error px-3 py-2 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{deleteHouseholdError}</span>
            </div>
          )}

          {deleteHouseholdStep === "confirm" ? (
            <>
              <div className="bg-error/10 p-4 rounded-lg space-y-2 border border-error/20">
                <div className="flex items-start gap-2 text-error">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-sm leading-relaxed font-semibold">
                    Are you absolutely sure?
                  </p>
                </div>
                <ul className="text-xs text-error/80 list-disc ml-8 space-y-1">
                  <li>This action cannot be undone.</li>
                  <li>All bills, members, and data will be permanently removed.</li>
                </ul>
              </div>
              <p className="text-sm text-secondary">
                A verification code will be sent to <span className="font-medium text-primary">{user?.email}</span> to confirm this action.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-secondary">
                Enter the 6-digit code sent to <span className="font-medium text-primary">{user?.email}</span>
              </p>
              <TextInput
                label="Verification code"
                placeholder="000000"
                value={deleteHouseholdOtp}
                onChange={(e) => {
                  setDeleteHouseholdOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                  if (deleteHouseholdError) setDeleteHouseholdError(null);
                }}
                maxLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={handleResendDeleteHouseholdOtp}
                disabled={deleteHouseholdCooldown > 0}
                className={`text-xs font-medium ${deleteHouseholdCooldown > 0 ? "text-secondary cursor-not-allowed" : "text-primary hover:text-accent"} transition-colors`}
              >
                {deleteHouseholdCooldown > 0 ? `Resend code in ${deleteHouseholdCooldown}s` : "Resend code"}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* ── Role Change Modal ──────────────────────────────────────────── */}
      <Modal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change Role"
        subtitle={selectedMember ? `For ${getMemberName(selectedMember)}` : undefined}
      >
        <div className="space-y-3 mt-4">
          <button
            type="button"
            onClick={async () => {
              if (!selectedMember || selectedMember.member.role === "admin") return;
              try {
                await setMemberRole(selectedMember.member.id, "admin");
                showToast("Role updated to Admin", "success");
                setShowRoleModal(false);
                await loadMembers(householdId);
              } catch (e) {
                showToast(friendlyError(e), "error");
              }
            }}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              selectedMember?.member.role === "admin" ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30" : "border-border hover:border-primary/30 bg-surface"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-blue-500" />
                <span className={`text-sm font-semibold ${selectedMember?.member.role === "admin" ? "text-blue-500" : "text-primary"}`}>Admin</span>
              </div>
              {selectedMember?.member.role === "admin" && <CheckCircle2 size={18} className="text-blue-500" />}
            </div>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Can create, edit, and manage bills. Cannot edit household details, invite or remove members, delete the household, or transfer ownership.
            </p>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (!selectedMember || selectedMember.member.role === "member") return;
              try {
                await setMemberRole(selectedMember.member.id, "member");
                showToast("Role updated to Member", "success");
                setShowRoleModal(false);
                await loadMembers(householdId);
              } catch (e) {
                showToast(friendlyError(e), "error");
              }
            }}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              selectedMember?.member.role === "member" ? "border-neutral-500/50 bg-neutral-500/5 ring-1 ring-neutral-500/30" : "border-border hover:border-primary/30 bg-surface"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <User size={18} className="text-neutral-500" />
                <span className={`text-sm font-semibold ${selectedMember?.member.role === "member" ? "text-neutral-500" : "text-primary"}`}>Member</span>
              </div>
              {selectedMember?.member.role === "member" && <CheckCircle2 size={18} className="text-neutral-500" />}
            </div>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Can view bills. Cannot add, edit, or mark bills as paid.
            </p>
          </button>
        </div>
      </Modal>
    </div>
  );
}