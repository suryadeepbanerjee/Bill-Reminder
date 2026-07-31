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

    // Client with the caller's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── 1. Verify caller ───────────────────────────────────────────────────
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Find the pending invite ─────────────────────────────────────────
    const { data: invite, error: fetchError } = await adminClient
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .eq("user_id", caller.id)
      .eq("status", "invited")
      .single();

    if (fetchError || !invite) {
      return new Response(
        JSON.stringify({ error: "No pending invitation found for this household" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Activate membership ─────────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from("household_members")
      .update({ status: "active" })
      .eq("id", invite.id);

    if (updateError) {
      throw new Error(`Failed to activate membership: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("accept-invite error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
