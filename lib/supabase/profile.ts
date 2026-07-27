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
  input:  { display_name?: string }
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

/** Returns the user's primary (personal) household + their role */
export async function fetchUserHousehold(userId: string): Promise<{
  household: Household;
  member:    HouseholdMember;
} | null> {
  const { data } = await supabase
    .from("household_members")
    .select(`
      *,
      households (*)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    household: (data as any).households as Household,
    member:    data as HouseholdMember,
  };
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
