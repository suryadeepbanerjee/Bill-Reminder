import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Household, HouseholdMember, HouseholdRole } from "../types";

export interface ProfileApi {
  fetchProfile(userId: string): Promise<Profile | null>;
  updateProfile(
    userId: string,
    input:  { display_name?: string; avatar_url?: string; email?: string; email_notifications_enabled?: boolean }
  ): Promise<Profile>;
  fetchAllUserHouseholds(userId: string): Promise<{
    household: Household;
    member:    HouseholdMember;
  }[]>;
  /** Fetch the user's active households; if the user has none (they left/acked
   * their default, or were kicked out of it), auto-create a default household
   * so the app always has something to render. */
  ensureAtLeastOneHousehold(userId: string): Promise<{
    household: Household;
    member:    HouseholdMember;
  }[]>;
  fetchUserHousehold(userId: string): Promise<{
    household: Household;
    member:    HouseholdMember;
  } | null>;
  fetchHouseholdMembers(householdId: string): Promise<{
    member:    HouseholdMember;
    profile:   Profile | null;
  }[]>;
  createHousehold(name: string, userId: string): Promise<{ household: Household; member: HouseholdMember }>;
  inviteToHousehold(householdId: string, email: string): Promise<{ success: boolean; message: string }>;
  leaveToHousehold(householdId: string): Promise<{ success: boolean; message: string }>;
  membershipExists(householdId: string, userId: string): Promise<{ exists: boolean; status: string | null }>;
  removeMember(memberId: string): Promise<void>;
  setMemberRole(memberId: string, role: HouseholdRole): Promise<void>;
  renameHousehold(householdId: string, newName: string): Promise<void>;
  deleteHousehold(householdId: string): Promise<void>;
  acceptInvite(householdId: string): Promise<{ success: boolean }>;
  deleteAccount(): Promise<void>;
  savePushToken(userId: string, expoPushToken: string, deviceLabel?: string): Promise<void>;
  transferOwnershipRequest(householdId: string, targetMemberId: string): Promise<{ success: boolean; message: string }>;
  transferOwnershipConfirm(householdId: string, targetMemberId: string, otpToken: string): Promise<{ success: boolean }>;
}

/**
 * Client-bound profile/household data layer.
 *
 * Edge function calls use `supabase.functions.invoke`, which injects the
 * session's Authorization header automatically — no per-platform env plumbing.
 */
export function createProfileApi(supabase: SupabaseClient): ProfileApi {
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return data as Profile | null;
  };

  const updateProfile = async (
    userId: string,
    input:  { display_name?: string; avatar_url?: string; email?: string; email_notifications_enabled?: boolean }
  ): Promise<Profile> => {
    const { data, error } = await supabase
      .from("profiles")
      .update(input)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  };

  const fetchAllUserHouseholds = async (userId: string): Promise<{
    household: Household;
    member:    HouseholdMember;
  }[]> => {
    const { data, error } = await supabase
      .from("household_members")
      .select(`
        *,
        households (*)
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!data) return [];

    return data.map((row: any) => ({
      household: row.households as Household,
      member:    row as HouseholdMember,
    }));
  };

  const ensureAtLeastOneHousehold = async (userId: string) => {
    let list = await fetchAllUserHouseholds(userId);
    if (list.length === 0) {
      // They left / were kicked out of their only household — create a fresh
      // default one so the app can still render bills & money views.
      const created = await createHousehold("My Household", userId);
      list = [created];
    }
    return list;
  };

  const fetchUserHousehold = async (userId: string): Promise<{
    household: Household;
    member:    HouseholdMember;
  } | null> => {
    const all = await fetchAllUserHouseholds(userId);
    return all.length > 0 ? all[0] : null;
  };

  const fetchHouseholdMembers = async (householdId: string): Promise<{
    member:    HouseholdMember;
    profile:   Profile | null;
  }[]> => {
    const { data, error } = await supabase
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!data) return [];

    const results: { member: HouseholdMember; profile: Profile | null }[] = [];

    for (const row of data) {
      let profile: Profile | null = null;
      if (row.user_id) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", row.user_id)
          .maybeSingle();
        profile = pData as Profile | null;
      }
      results.push({ member: row as HouseholdMember, profile });
    }

    return results;
  };

  const createHousehold = async (
    name: string,
    userId: string
  ): Promise<{ household: Household; member: HouseholdMember }> => {
    const { data, error } = await supabase.functions.invoke("create-household", {
      body: { name },
    });
    if (error) throw new Error(await extractInvokeError(error));

    const household = (data as { household: Household }).household;
    return {
      household,
      member: {
        id:           "",
        household_id: household.id,
        user_id:      userId,
        role:         "super_admin",
        status:       "active",
        created_at:   household.created_at,
      } as HouseholdMember,
    };
  };

  const inviteToHousehold = async (
    householdId: string,
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { householdId, email },
    });
    if (error) throw new Error(await extractInvokeError(error));
    return data as { success: boolean; message: string };
  };

  const leaveToHousehold = async (
    householdId: string
  ): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabase.functions.invoke("leave-household", {
      body: { householdId },
    });
    if (error) throw new Error(await extractInvokeError(error));
    return data as { success: boolean; message: string };
  };

  const membershipExists = async (householdId: string, userId: string): Promise<{ exists: boolean; status: string | null }> => {
    const { data, error } = await supabase
      .from("household_members")
      .select("status")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { exists: false, status: null };
    return { exists: true, status: data.status as string };
  };

  const removeMember = async (memberId: string): Promise<void> => {
    const { error } = await supabase
      .from("household_members")
      .update({ status: "removed" })
      .eq("id", memberId);

    if (error) throw new Error(error.message);
  };

  const renameHousehold = async (
    householdId: string,
    newName: string
  ): Promise<void> => {
    const { error } = await supabase
      .from("households")
      .update({ name: newName })
      .eq("id", householdId);

    if (error) throw new Error(error.message);
  };

  const deleteHousehold = async (householdId: string): Promise<void> => {
    const { error } = await supabase.functions.invoke("delete-household", {
      body: { householdId },
    });
    if (error) throw new Error(error.message ?? "Request failed");
  };

  const acceptInvite = async (
    householdId: string
  ): Promise<{ success: boolean }> => {
    const { data, error } = await supabase.functions.invoke("accept-invite", {
      body: { householdId },
    });
    if (error) throw new Error(error.message ?? "Failed to accept invite");
    return data as { success: boolean };
  };

  const deleteAccount = async (): Promise<void> => {
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: {},
    });
    if (error) throw new Error(error.message ?? "Request failed");
    // Ownership guard rejections arrive as 200 + success:false so the
    // readable note survives the invoke() error wrapper (audit finding).
    if (data && typeof data === "object" && "success" in data && (data as { success: boolean }).success === false) {
      throw new Error((data as { error?: string }).error ?? "Account deletion was blocked.");
    }
  };

  const savePushToken = async (
    userId:         string,
    expoPushToken:  string,
    deviceLabel?:   string
  ): Promise<void> => {
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id:          userId,
          expo_push_token:  expoPushToken,
          device_label:     deviceLabel ?? null,
          last_used_at:     new Date().toISOString(),
        },
        { onConflict: "expo_push_token" }
      );

    if (error) throw new Error(error.message);
  };

  const setMemberRole = async (
    memberId: string,
    role: HouseholdRole
  ): Promise<void> => {
    const { error } = await supabase
      .from("household_members")
      .update({ role })
      .eq("id", memberId);

    if (error) throw new Error(error.message);
  };

  const transferOwnershipRequest = async (
    householdId: string,
    targetMemberId: string
  ): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabase.functions.invoke("transfer-ownership", {
      body: { phase: "request", householdId, targetMemberId },
    });
    if (error) throw new Error(await extractInvokeError(error));
    return data as { success: boolean; message: string };
  };

  const transferOwnershipConfirm = async (
    householdId: string,
    targetMemberId: string,
    otpToken: string
  ): Promise<{ success: boolean }> => {
    const { data, error } = await supabase.functions.invoke("transfer-ownership", {
      body: { phase: "confirm", householdId, targetMemberId, otpToken },
    });
    if (error) throw new Error(await extractInvokeError(error));
    return data as { success: boolean };
  };

  return {
    fetchProfile,
    updateProfile,
    fetchAllUserHouseholds,
    ensureAtLeastOneHousehold,
    fetchUserHousehold,
    fetchHouseholdMembers,
    createHousehold,
    inviteToHousehold,
    leaveToHousehold,
    membershipExists,
    removeMember,
    setMemberRole,
    renameHousehold,
    deleteHousehold,
    acceptInvite,
    deleteAccount,
    savePushToken,
    transferOwnershipRequest,
    transferOwnershipConfirm,
  };
}

/**
 * Surface the server's JSON `error` field from a failed edge-function call.
 * `FunctionsHttpError` only exposes a generic "non-2xx status code" message;
 * callers need the real reason (e.g. "already a member") to branch on it.
 */
async function extractInvokeError(error: unknown): Promise<string> {
  try {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      const body = await res.json();
      if (typeof (body as { error?: unknown })?.error === "string") {
        return (body as { error: string }).error;
      }
    }
  } catch {
    /* fall through to the generic message */
  }
  return (error as { message?: string })?.message ?? "Request failed";
}
