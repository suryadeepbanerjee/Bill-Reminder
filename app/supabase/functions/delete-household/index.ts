import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { householdId } = await req.json();
    if (!householdId) {
      return new Response(
        JSON.stringify({ error: "householdId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete household (cascades to members, bills, categories, etc.)
    const { error: delError } = await admin
      .from("households")
      .delete()
      .eq("id", householdId);

    if (delError) throw new Error(delError.message);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("delete-household error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
