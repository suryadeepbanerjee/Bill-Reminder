// Edge Function: delete-account
// Called by: client (authenticated user) after OTP verification
// Responsibility: Delete user's data from public tables, then delete auth user via Admin API

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import { getRateLimiter } from "../_shared/rate-limit.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Create a client with the user's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Rate limit: destructive action, per authenticated user
    const blocked = await getRateLimiter().enforce(req, "delete-account", {
      type: "user",
      value: user.id,
    });
    if (blocked) return blocked;

    const userId = user.id;
    console.log(`[delete-account] Starting deletion for user`);

    // Create admin client for data cleanup and auth deletion
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the user's bill IDs
    const { data: userBills } = await adminClient
      .from("bills")
      .select("id")
      .eq("created_by", userId);
    const billIds = userBills?.map((b: { id: string }) => b.id) || [];
    console.log(`[delete-account] Found ${billIds.length} bills`);

    // 2. Get occurrence IDs for those bills
    let occurrenceIds: string[] = [];
    if (billIds.length > 0) {
      const { data: occurrences } = await adminClient
        .from("bill_occurrences")
        .select("id")
        .in("bill_id", billIds);
      occurrenceIds = occurrences?.map((o: { id: string }) => o.id) || [];
    }
    console.log(`[delete-account] Found ${occurrenceIds.length} occurrences`);

    // 3. Cancel pending scheduled reminders
    if (occurrenceIds.length > 0) {
      const { error: srErr } = await adminClient
        .from("scheduled_reminders")
        .update({ status: "cancelled" })
        .in("occurrence_id", occurrenceIds)
        .eq("status", "pending");
      if (srErr) console.error("[delete-account] Error cancelling scheduled reminders:", srErr.message);
    }

    // 4. Delete notification log entries for this user
    const { error: nlErr } = await adminClient
      .from("notification_log")
      .delete()
      .eq("user_id", userId);
    if (nlErr) console.error("[delete-account] Error deleting notification_log:", nlErr.message);

    // 5. Delete push tokens for this user
    const { error: ptErr } = await adminClient
      .from("push_tokens")
      .delete()
      .eq("user_id", userId);
    if (ptErr) console.error("[delete-account] Error deleting push_tokens:", ptErr.message);

    // 6. Get households the user belongs to
    const { data: memberships } = await adminClient
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId);
    const householdIds = memberships?.map((m: { household_id: string }) => m.household_id) || [];
    console.log(`[delete-account] Found ${householdIds.length} households`);

    // 6b. Ownership guard — a super_admin who still has other active members
    // in their household must not delete the account: it would orphan every
    // member of that household. They have to transfer ownership first
    // (transfer-ownership edge function) so the household keeps an owner.
    const { data: ownedHomes } = await adminClient
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("role", "super_admin");

    for (const owned of ownedHomes ?? []) {
      const { count, error: countError } = await adminClient
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("household_id", owned.household_id)
        .neq("user_id", userId)
        .eq("status", "active");
      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        console.warn(
          "[delete-account] Blocked: user still owns a household with other members"
        );
        // 200 + success:false — the SDK treats non-2xx as an opaque
        // FunctionsHttpError, which would swallow this note into the
        // generic "Something went wrong" fallback on the clients.
        return new Response(
          JSON.stringify({
            success: false,
            error:   "You still own a household with other members. Transfer ownership to another member before deleting your account.",
          }),
          { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // 7. Determine which households will be deleted (sole-member), then delete
    //    audit log entries the user is the actor of OR that belong to
    //    sole-member households. Shared-household audit history is preserved —
    //    deleting it would destroy other members' history (audit finding).
    const soleHouseholdIds: string[] = [];
    for (const householdId of householdIds) {
      const { data: otherMembers } = await adminClient
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .neq("user_id", userId)
        .eq("status", "active");

      if (!otherMembers || otherMembers.length === 0) {
        soleHouseholdIds.push(householdId);
      }
    }

    if (householdIds.length > 0) {
      const conditions = [`actor_id.eq.${userId}`];
      if (soleHouseholdIds.length > 0) {
        conditions.push(`household_id.in.(${soleHouseholdIds.join(",")})`);
      }
      const { error: alErr } = await adminClient
        .from("audit_log")
        .delete()
        .or(conditions.join(","));
      if (alErr) console.error("[delete-account] Error deleting audit_log:", alErr.message);
    }

    // 8. Delete sole-member households (personal households)
    for (const householdId of soleHouseholdIds) {
      const { error: hhErr } = await adminClient
        .from("households")
        .delete()
        .eq("id", householdId);
      if (hhErr) console.error("[delete-account] Error deleting household:", hhErr.message);
      else console.log("[delete-account] Deleted household");
    }

    // 9. Delete remaining household memberships
    const { error: hmErr } = await adminClient
      .from("household_members")
      .delete()
      .eq("user_id", userId);
    if (hmErr) console.error("[delete-account] Error deleting household_members:", hmErr.message);

    // 10. Delete the profile
    const { error: profErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profErr) console.error("[delete-account] Error deleting profile:", profErr.message);

    // 11. Delete the auth user via Admin API
    console.log(`[delete-account] Deleting auth user`);
    const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[delete-account] Error deleting auth user:", delErr.message);
      throw delErr;
    }

    console.log(`[delete-account] Successfully deleted user`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return internalError(req, "delete-account", error);
  }
});
