import type { HouseholdRole } from "@shared/types";

const EDIT_ROLES: readonly HouseholdRole[] = ["super_admin", "admin"];
const INVITE_ROLES: readonly HouseholdRole[] = ["super_admin"];
const MANAGE_ROLES: readonly HouseholdRole[] = ["super_admin"];

export function canEditBills(role: HouseholdRole | null | undefined): boolean {
  return !!role && EDIT_ROLES.includes(role);
}

export function canInviteMembers(role: HouseholdRole | null | undefined): boolean {
  return !!role && INVITE_ROLES.includes(role);
}

export function canManageHousehold(role: HouseholdRole | null | undefined): boolean {
  return !!role && MANAGE_ROLES.includes(role);
}

export function isSuperAdmin(role: HouseholdRole | null | undefined): boolean {
  return role === "super_admin";
}

export function isAdmin(role: HouseholdRole | null | undefined): boolean {
  return role === "admin";
}

const ROLE_LABELS: Record<HouseholdRole, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
  member:      "Member",
};

export function roleLabel(role: HouseholdRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : "Member";
}

export const ROLE_OPTIONS: ReadonlyArray<{ value: HouseholdRole; label: string }> = [
  { value: "admin",  label: "Admin" },
  { value: "member", label: "Member" },
];