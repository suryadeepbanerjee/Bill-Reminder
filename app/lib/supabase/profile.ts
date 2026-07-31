import { supabase } from "./client";
import type { Profile, Household, HouseholdMember } from "./types";

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

/** Returns the user's primary (personal) household + their role (legacy compat) */
export async function fetchUserHousehold(userId: string): Promise<{
  household: Household;
  member:    HouseholdMember;
} | null> {
  const all = await fetchAllUserHouseholds(userId);
  return all.length > 0 ? all[0] : null;
}

/** Fetch all members of a household */
export async function fetchHouseholdMembers(householdId: string): Promise<{
  member:    HouseholdMember;
  profile:   Profile | null;
}[]> {
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
}

/** Create a new household and return it with the user as admin */
export async function createHousehold(
  name: string,
  userId: string
): Promise<{ household: Household; member: HouseholdMember }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${supabaseUrl}/functions/v1/create-household`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type":  "application/json",
      "apikey":        supabaseAnonKey,
    },
    body: JSON.stringify({ name }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);

  return {
    household: body.household as Household,
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const url = `${supabaseUrl}/functions/v1/invite-member`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type":  "application/json",
      "apikey":        supabaseAnonKey,
    },
    body: JSON.stringify({ householdId, email }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as { success: boolean; message: string };
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

/** Delete a household (admin only, cannot delete your only household) */
export async function deleteHousehold(householdId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${supabaseUrl}/functions/v1/delete-household`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type":  "application/json",
      "apikey":        supabaseAnonKey,
    },
    body: JSON.stringify({ householdId }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
}

/** Accept an invite token */
export async function acceptInvite(
  householdId: string
): Promise<{ success: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("accept-invite", {
    body: { householdId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw new Error(error.message ?? "Failed to accept invite");
  return data as { success: boolean };
}

export async function savePushToken(
  userId:         string,
  expoPushToken:  string,
  deviceLabel?:   string
): Promise<void> {
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
}
