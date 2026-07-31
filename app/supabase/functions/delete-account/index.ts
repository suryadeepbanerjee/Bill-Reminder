// Edge Function: delete-account
// Called by: client (authenticated user) after OTP verification
// Responsibility: Delete user's data from public tables, then delete auth user via Admin API

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Starting deletion for user ${userId}`);

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

    // 7. Delete audit log entries for those households
    if (householdIds.length > 0) {
      const { error: alErr } = await adminClient
        .from("audit_log")
        .delete()
        .in("household_id", householdIds);
      if (alErr) console.error("[delete-account] Error deleting audit_log:", alErr.message);
    }

    // 8. Delete households where this user is the sole member (personal households)
    for (const householdId of householdIds) {
      const { data: otherMembers } = await adminClient
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .neq("user_id", userId)
        .eq("status", "active");

      if (!otherMembers || otherMembers.length === 0) {
        const { error: hhErr } = await adminClient
          .from("households")
          .delete()
          .eq("id", householdId);
        if (hhErr) console.error(`[delete-account] Error deleting household ${householdId}:`, hhErr.message);
        else console.log(`[delete-account] Deleted household ${householdId}`);
      }
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
    console.log(`[delete-account] Deleting auth user ${userId}`);
    const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[delete-account] Error deleting auth user:", delErr.message);
      throw delErr;
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[delete-account] Fatal error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
