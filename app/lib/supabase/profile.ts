import { supabase } from "./client";
import { guardAsync } from "@shared/utils/action-guard";
import { createProfileApi } from "@shared/supabase/profile";
import type { Profile, Household, HouseholdMember } from "@shared/types";

const api = createProfileApi(supabase);

export const fetchProfile = api.fetchProfile;
export const updateProfile = api.updateProfile;
export const fetchAllUserHouseholds = api.fetchAllUserHouseholds;
export const fetchUserHousehold = api.fetchUserHousehold;
export const fetchHouseholdMembers = api.fetchHouseholdMembers;
export const savePushToken = api.savePushToken;

export function createHousehold(
  name: string,
  userId: string
): Promise<{ household: Household; member: HouseholdMember }> {
  return guardAsync(`mut:create-household:${name.trim()}`, () =>
    api.createHousehold(name, userId)
  ) as Promise<{ household: Household; member: HouseholdMember }>;
}

export function inviteToHousehold(
  householdId: string,
  email: string
): Promise<{ success: boolean; message: string }> {
  return guardAsync(`mut:invite:${householdId}:${email}`, () =>
    api.inviteToHousehold(householdId, email)
  ) as Promise<{ success: boolean; message: string }>;
}

export function removeMember(memberId: string): Promise<void> {
  return guardAsync(`mut:remove-member:${memberId}`, () =>
    api.removeMember(memberId)
  ) as Promise<void>;
}

export function leaveToHousehold(
  householdId: string
): Promise<{ success: boolean; message: string }> {
  return guardAsync(`mut:leave-household:${householdId}`, () =>
    api.leaveToHousehold(householdId)
  ) as Promise<{ success: boolean; message: string }>;
}

export function renameHousehold(householdId: string, newName: string): Promise<void> {
  return guardAsync(`mut:rename-household:${householdId}:${newName.trim()}`, () =>
    api.renameHousehold(householdId, newName)
  ) as Promise<void>;
}

export function deleteHousehold(householdId: string): Promise<void> {
  return guardAsync(`mut:delete-household:${householdId}`, () =>
    api.deleteHousehold(householdId)
  ) as Promise<void>;
}

export function acceptInvite(householdId: string): Promise<{ success: boolean }> {
  return guardAsync(`mut:accept-invite:${householdId}`, () =>
    api.acceptInvite(householdId)
  ) as Promise<{ success: boolean }>;
}

export type { Profile, Household, HouseholdMember };
