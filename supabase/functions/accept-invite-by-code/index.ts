import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

/**
 * accept-invite-by-code — public endpoint (no JWT required).
 *
 * Accepts a household invite using a one-time token (the household_members.id
 * UUID) that was embedded in the invite email link. Because the token is a
 * 128-bit random UUID and is single-use (status flips to "active"), no auth
 * is needed — knowledge of the code IS the proof of identity.
 *
 * Body: { code: string, householdId: string }
 *
 * Responses:
 *   200 { success: true }                — accepted (or already active)
 *   400 { error }                        — missing params
 *   404 { error }                        — invite not found / expired
 *   409 { error }                        — invite in an invalid state
 *   500 { error }                        — unexpected server error
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { code, householdId } = await req.json();

    if (!code || !householdId) {
      return new Response(
        JSON.stringify({ error: "code and householdId are required" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── 1. Look up the invite by its row ID (the one-time code) ──────────────
    const { data: invite, error: fetchError } = await adminClient
      .from("household_members")
      .select("id, status, user_id, household_id")
      .eq("id", code)
      .eq("household_id", householdId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Invite lookup failed: ${fetchError.message}`);
    }

    if (!invite) {
      return new Response(
        JSON.stringify({
          error: "Invitation not found. The link may have already been used or is invalid.",
        }),
        { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 2. Already accepted — idempotent success ──────────────────────────────
    if (invite.status === "active") {
      return new Response(
        JSON.stringify({ success: true, alreadyAccepted: true }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 3. Must be in "invited" state ─────────────────────────────────────────
    if (invite.status !== "invited") {
      return new Response(
        JSON.stringify({ error: "This invitation is no longer valid." }),
        { status: 409, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 4. Activate — user_id was set when invite was created ─────────────────
    const { error: updateError } = await adminClient
      .from("household_members")
      .update({ status: "active" })
      .eq("id", invite.id);

    if (updateError) {
      throw new Error(`Failed to activate membership: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return internalError(req, "accept-invite-by-code", err);
  }
});
