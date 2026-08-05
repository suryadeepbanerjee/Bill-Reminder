import { supabase } from "../supabase";
import type { Profile, Household, HouseholdMember } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  input:  { display_name?: string; avatar_url?: string; email?: string; email_notifications_enabled?: boolean }
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

// ── Households ────────────────────────────────────────────────────────────────

/** Returns ALL households the user belongs to (with their membership row) */
export async function fetchAllUserHouseholds(userId: string): Promise<{
  household: Household;
  member:    HouseholdMember;
}[]> {
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
}

/** Fetch all members of a household (batched profile fetch, not N+1) */
export async function fetchHouseholdMembers(householdId: string): Promise<{
  member:  HouseholdMember;
  profile: Profile | null;
}[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  const userIds = data
    .map((row) => (row as HouseholdMember).user_id)
    .filter((id): id is string => Boolean(id));

  const profileById = new Map<string, Profile>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Profile[]) {
      profileById.set(p.id, p);
    }
  }

  return (data as HouseholdMember[]).map((row) => ({
    member:  row,
    profile: row.user_id ? profileById.get(row.user_id) ?? null : null,
  }));
}

// ── Edge function calls ───────────────────────────────────────────────────────

async function invokeFunction<T = unknown>(fn: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Create a new household and return it with the user as admin */
export async function createHousehold(
  name: string,
  userId: string
): Promise<{ household: Household; member: HouseholdMember }> {
  const body = await invokeFunction<{ household: Household }>("create-household", { name });
  return {
    household: body.household,
    member: {
      id:           "",
      household_id: body.household.id,
      user_id:      userId,
      role:         "admin",
      status:       "active",
      created_at:   body.household.created_at,
    } as HouseholdMember,
  };
}

/** Invite a user to a household — sends invite email */
export async function inviteToHousehold(
  householdId: string,
  email: string
): Promise<{ success: boolean; message: string }> {
  return invokeFunction("invite-member", { householdId, email });
}

/** Delete a household (admin only, cannot delete your only household) */
export async function deleteHousehold(householdId: string): Promise<void> {
  await invokeFunction("delete-household", { householdId });
}

/** Accept an invite token */
export async function acceptInvite(
  householdId: string
): Promise<{ success: boolean }> {
  return invokeFunction("accept-invite", { householdId });
}

/** Remove a member from a household (admin only) */
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("household_members")
    .update({ status: "removed" })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
}

/** Rename a household (admin only) */
export async function renameHousehold(
  householdId: string,
  newName: string
): Promise<void> {
  const { error } = await supabase
    .from("households")
    .update({ name: newName })
    .eq("id", householdId);

  if (error) throw new Error(error.message);
}

/** Delete the user's account permanently (edge function, admin/self only) */
export async function deleteAccount(): Promise<void> {
  await invokeFunction("delete-account", {});
}