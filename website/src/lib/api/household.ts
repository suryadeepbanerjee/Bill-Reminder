import { supabase } from "../supabase";
import { createProfileApi } from "@shared/supabase/profile";

const api = createProfileApi(supabase);

export const fetchProfile = api.fetchProfile;
export const updateProfile = api.updateProfile;
export const fetchAllUserHouseholds = api.fetchAllUserHouseholds;
export const fetchHouseholdMembers = api.fetchHouseholdMembers;
export const createHousehold = api.createHousehold;
export const inviteToHousehold = api.inviteToHousehold;
export const leaveToHousehold = api.leaveToHousehold;
export const deleteHousehold = api.deleteHousehold;
export const acceptInvite = api.acceptInvite;
export const removeMember = api.removeMember;
export const renameHousehold = api.renameHousehold;
export const deleteAccount = api.deleteAccount;
