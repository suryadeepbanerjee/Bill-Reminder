import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Household, HouseholdMember } from "../types";

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
  removeMember(memberId: string): Promise<void>;
  renameHousehold(householdId: string, newName: string): Promise<void>;
  deleteHousehold(householdId: string): Promise<void>;
  acceptInvite(householdId: string): Promise<{ success: boolean }>;
  deleteAccount(): Promise<void>;
  savePushToken(userId: string, expoPushToken: string, deviceLabel?: string): Promise<void>;
}

/**
 * Client-bound profile/household data layer.
 *
 * Edge function calls use `supabase.functions.invoke`, which injects the
 * session's Authorization header automatically — no per-platform env plumbing.
 */
export function createProfileApi(supabase: SupabaseClient): ProfileApi {
  return {
    async fetchProfile(userId: string): Promise<Profile | null> {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      return data as Profile | null;
    },

    async updateProfile(
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
    },

    // Returns ALL households the user belongs to (with their membership row)
    async fetchAllUserHouseholds(userId: string): Promise<{
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
    },

    // Returns the user's primary (personal) household + their role (legacy compat)
    async fetchUserHousehold(userId: string): Promise<{
      household: Household;
      member:    HouseholdMember;
    } | null> {
      const all = await this.fetchAllUserHouseholds(userId);
      return all.length > 0 ? all[0] : null;
    },

    // Fetch all members of a household
    async fetchHouseholdMembers(householdId: string): Promise<{
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
    },

    // Create a new household and return it with the user as admin
    async createHousehold(
      name: string,
      userId: string
    ): Promise<{ household: Household; member: HouseholdMember }> {
      const { data, error } = await supabase.functions.invoke("create-household", {
        body: { name },
      });
      if (error) throw new Error(error.message ?? "Request failed");

      const household = (data as { household: Household }).household;
      return {
        household,
        member: {
          id:           "",
          household_id: household.id,
          user_id:      userId,
          role:         "admin",
          status:       "active",
          created_at:   household.created_at,
        } as HouseholdMember,
      };
    },

    // Invite a user to a household — sends invite email
    async inviteToHousehold(
      householdId: string,
      email: string
    ): Promise<{ success: boolean; message: string }> {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { householdId, email },
      });
      if (error) throw new Error(error.message ?? "Request failed");
      return data as { success: boolean; message: string };
    },

    // Remove a member from a household (admin only)
    async removeMember(memberId: string): Promise<void> {
      const { error } = await supabase
        .from("household_members")
        .update({ status: "removed" })
        .eq("id", memberId);

      if (error) throw new Error(error.message);
    },

    // Rename a household (admin only)
    async renameHousehold(
      householdId: string,
      newName: string
    ): Promise<void> {
      const { error } = await supabase
        .from("households")
        .update({ name: newName })
        .eq("id", householdId);

      if (error) throw new Error(error.message);
    },

    // Delete a household (admin only, cannot delete your only household)
    async deleteHousehold(householdId: string): Promise<void> {
      const { error } = await supabase.functions.invoke("delete-household", {
        body: { householdId },
      });
      if (error) throw new Error(error.message ?? "Request failed");
    },

    // Accept an invite token
    async acceptInvite(
      householdId: string
    ): Promise<{ success: boolean }> {
      const { data, error } = await supabase.functions.invoke("accept-invite", {
        body: { householdId },
      });
      if (error) throw new Error(error.message ?? "Failed to accept invite");
      return data as { success: boolean };
    },

    // Delete the user's account permanently (edge function, admin/self only)
    async deleteAccount(): Promise<void> {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: {},
      });
      if (error) throw new Error(error.message ?? "Request failed");
    },

    async savePushToken(
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
    },
  };
}
