import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { householdId } = await req.json();
    if (!householdId) {
      return new Response(
        JSON.stringify({ error: "householdId is required" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader  = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const { data: callerMember } = await admin
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!callerMember || callerMember.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can delete households" }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if user has other households (can't delete your only household)
    const { count } = await admin
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your only household" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Clean up orphaned rows BEFORE deleting the household:
    // - audit_log.household_id is ON DELETE SET NULL (010) — rows would survive
    //   as orphans; delete them by household explicitly.
    // - notification_log.scheduled_reminder_id is ON DELETE SET NULL (008) —
    //   rows for this household's reminders would survive; delete via the
    //   occurrence → scheduled_reminder chain.
    await admin.from("audit_log").delete().eq("household_id", householdId);

    const { data: occIds } = await admin
      .from("bill_occurrences")
      .select("id")
      .in(
        "bill_id",
        (await admin.from("bills").select("id").eq("household_id", householdId)).data?.map(
          (b: { id: string }) => b.id
        ) ?? []
      );

    const occIdList = occIds?.map((o: { id: string }) => o.id) ?? [];
    if (occIdList.length > 0) {
      const { data: remIds } = await admin
        .from("scheduled_reminders")
        .select("id")
        .in("occurrence_id", occIdList);
      const remIdList = remIds?.map((r: { id: string }) => r.id) ?? [];
      if (remIdList.length > 0) {
        await admin
          .from("notification_log")
          .delete()
          .in("scheduled_reminder_id", remIdList);
      }
    }

    // Delete household (cascades to members, bills, categories, etc.)
    const { error: delError } = await admin
      .from("households")
      .delete()
      .eq("id", householdId);

    if (delError) throw new Error(delError.message);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return internalError(req, "delete-household", err);
  }
});
