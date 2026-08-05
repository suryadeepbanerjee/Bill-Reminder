import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "../../stores/auth-store";
import { useHouseholdStore } from "../../stores/household-store";
import {
  fetchHouseholdMembers,
  inviteToHousehold,
  removeMember,
  renameHousehold,
  deleteHousehold,
  createHousehold,
} from "../../lib/api/household";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { useConfirm } from "../../components/ui/Confirm";
import { InviteResendButton } from "../../components/household/InviteResendButton";
import { useToast } from "../../components/ui/Toast";
import { friendlyError } from "../../lib/errors";
import type { HouseholdMember, Profile } from "../../lib/types";

const INVITE_EXPIRY_HOURS = 24;
const REINVITE_COOLDOWN_HOURS = 1;

function isInviteExpired(createdAt: string): boolean {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60) > INVITE_EXPIRY_HOURS;
}

function isInviteWithinCooldown(createdAt: string): boolean {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60) < REINVITE_COOLDOWN_HOURS;
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
  const setHouseholds = useHouseholdStore((s) => s.setHouseholds);
  const households = useHouseholdStore((s) => s.households);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [emailToInvite, setEmailToInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [creatingHousehold, setCreatingHousehold] = useState(false);

  const householdId = activeHousehold?.household.id ?? "";
  const isAdmin = activeHousehold?.member.role === "admin";

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

  useEffect(() => {
    if (!householdId) return;
    loadMembers(householdId);
  }, [householdId, loadMembers]);

  const activeMembers = useMemo(
    () =>
      members.filter((m) => {
        if (m.member.status !== "invited") return true;
        return !isInviteExpired(m.member.created_at);
      }),
    [members]
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
    if (recentInvite && isInviteWithinCooldown(recentInvite.member.created_at)) {
      const hoursElapsed = (Date.now() - new Date(recentInvite.member.created_at).getTime()) / (1000 * 60 * 60);
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
    try {
      await inviteToHousehold(householdId, email);
      showToast(`Invitation sent to ${email}`, "success");
      await loadMembers(householdId);
    } catch (e) {
      showToast(friendlyError(e), "error");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const ok = await confirm({
      title: "Remove member",
      message: `Are you sure you want to remove ${memberName} from the household?`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.member.id !== memberId));
      showToast(`${memberName} removed`, "success");
    } catch (e) {
      showToast(friendlyError(e), "error");
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
      const match = updated.find((h) => h.household.id === householdId);
      if (match) setActiveHousehold(match);
      setShowRename(false);
      showToast("Household renamed", "success");
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setRenaming(false);
    }
  };

  const handleCreateHousehold = async () => {
    const name = newHouseholdName.trim();
    if (!name || !user?.id) return;
    setCreatingHousehold(true);
    try {
      const result = await createHousehold(name, user.id);
      setHouseholds([...households, result]);
      setActiveHousehold(result);
      setShowCreateHousehold(false);
      setNewHouseholdName("");
      showToast("Household created", "success");
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setCreatingHousehold(false);
    }
  };

  const handleDeleteHousehold = async (targetId: string) => {
    const target = households.find((h) => h.household.id === targetId);
    if (!target) return;
    if (targetId === activeHousehold?.household.id) {
      showToast("You cannot delete your default household. Set another household as default first.", "error");
      return;
    }
    const ok = await confirm({
      title: "Delete household",
      message: `Are you sure you want to delete "${target.household.name}"? This will permanently remove all bills, members, and data.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      setDeleting(true);
      await deleteHousehold(targetId);
      const remaining = households.filter((h) => h.household.id !== targetId);
      setHouseholds(remaining);
      if (activeHousehold?.household.id === targetId && remaining.length > 0) {
        setActiveHousehold(remaining[0]);
      }
      queryClient.invalidateQueries({ queryKey: ["households", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["bills", targetId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", targetId] });
      queryClient.invalidateQueries({ queryKey: ["householdCategories", targetId] });
      showToast("Household deleted", "success");
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-1 mb-6">
        <button
          type="button"
          onClick={() => navigate("/app/settings")}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Manage Household</h1>
      </div>

      {/* ── Rename (admin) ─────────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <SectionHeader>Household Name</SectionHeader>
          <div className="bg-surface border border-border rounded-card p-4 space-y-3">
            {showRename ? (
              <>
                <TextInput
                  label="Household name"
                  placeholder="Enter new name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                />
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => { setShowRename(false); setRenameValue(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    fullWidth
                    onClick={handleRename}
                    loading={renaming}
                    disabled={!renameValue.trim()}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setRenameValue(activeHousehold?.household.name ?? ""); setShowRename(true); }}
                className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <span className="text-sm text-primary font-medium">
                  {activeHousehold?.household.name ?? "Household"}
                </span>
                <Pencil size={16} className="text-accent" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Invite (admin) ─────────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <SectionHeader>Invite a user</SectionHeader>
          <div className="bg-surface border border-border rounded-card p-4 space-y-3">
            <p className="text-sm text-secondary leading-relaxed">
              Send an invitation link to a user. Once they accept, they will be able to see and manage bills in this household.
            </p>
            <TextInput
              label="Email address"
              placeholder="user@example.com"
              type="email"
              value={emailToInvite}
              onChange={(e) => { setEmailToInvite(e.target.value); if (inviteError) setInviteError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
            />
            {inviteError && <p className="text-xs text-error">{inviteError}</p>}
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

      {/* ── Members list ───────────────────────────────────────────────── */}
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
                      {role === "admin" && (
                        <span className="bg-primary/10 px-1.5 py-0.5 rounded-sm text-[10px] text-primary font-bold uppercase tracking-wider shrink-0">
                          Admin
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

                {isAdmin && !isMe && m.member.status === "active" && (
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => handleRemoveMember(m.member.id, name)}
                    className="ml-2 bg-error/10 p-2 rounded-full text-error hover:bg-error/20 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {isAdmin && !isMe && m.member.status === "invited" && (
                  <InviteResendButton
                    member={m.member}
                    onResend={() => handleResend(m.member)}
                  />
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
          const isDefault = h.household.id === activeHousehold?.household.id;
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

              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setActiveHousehold(h)}
                  className="ml-2 bg-accent/10 px-3 py-1.5 rounded-full text-xs text-accent font-semibold hover:bg-accent/20 transition-colors shrink-0"
                >
                  Set default
                </button>
              )}
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

      {/* ── Danger zone ────────────────────────────────────────────────── */}
      {isAdmin && households.length > 1 && (
        <>
          <SectionHeader>Danger Zone</SectionHeader>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="p-4 space-y-3">
              <p className="text-sm text-secondary">
                Delete a non-default household to remove all its bills, members, and data permanently.
              </p>
              {households.filter((h) => h.household.id !== activeHousehold?.household.id).map((h) => (
                <button
                  key={h.household.id}
                  type="button"
                  onClick={() => handleDeleteHousehold(h.household.id)}
                  disabled={deleting}
                  className="w-full flex items-center justify-between py-3 px-4 bg-error/5 border border-error/20 rounded-lg text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium truncate">Delete "{h.household.name}"</span>
                  <Trash2 size={16} className="shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}