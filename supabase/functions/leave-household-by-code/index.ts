import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import { getRateLimiter, clientIp } from "../_shared/rate-limit.ts";

/**
 * leave-household-by-code — public endpoint (no JWT required).
 *
 * Confirms a household leave using the one-time token embedded in the
 * verification email (the household_members.id UUID). Once consumed, the
 * membership flips to "removed", so the link is single-use — knowledge of the
 * code IS the proof of identity (same model as accept-invite-by-code).
 *
 * Body: { code: string, householdId: string }
 *
 * Responses:
 *   200 { success: true }                — removed (or already removed)
 *   400 { error }                       — missing params
 *   404 { error }                       — link not found / already used
 *   409 { error }                       — membership in an invalid state
 *   500 { error }                       — unexpected server error
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    // Rate limit: public endpoint, anonymous → per IP
    const blocked = await getRateLimiter().enforce(req, "leave-household-by-code", {
      type: "ip",
      value: clientIp(req),
    });
    if (blocked) return blocked;

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

    // ── 1. Look up the membership by its row ID (the one-time code) ──────────
    const { data: member, error: fetchError } = await adminClient
      .from("household_members")
      .select("id, status, role, household_id")
      .eq("id", code)
      .eq("household_id", householdId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Leave lookup failed: ${fetchError.message}`);
    }

    if (!member) {
      return new Response(
        JSON.stringify({ error: "This link is no longer valid. It may have already been used." }),
        { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 2. Already left — idempotent success ─────────────────────────────────
    if (member.status === "removed") {
      return new Response(
        JSON.stringify({ success: true, alreadyLeft: true }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 3. Must be active ────────────────────────────────────────────────────
    if (member.status !== "active") {
      return new Response(
        JSON.stringify({ error: "This membership is no longer active." }),
        { status: 409, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── 4. Super admins need another active super admin behind them ──────────
    if (member.role === "super_admin") {
      const { data: otherAdmins, error: adminsError } = await adminClient
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("status", "active")
        .eq("role", "super_admin")
        .neq("id", member.id)
        .limit(1);

      if (adminsError) throw new Error(`Super admin lookup failed: ${adminsError.message}`);
      if (!otherAdmins || otherAdmins.length === 0) {
        return new Response(
          JSON.stringify({
            error: "You are the only super admin in this household, so you cannot leave. Delete the household from the app instead.",
          }),
          { status: 409, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    }

    // ── 5. Remove ────────────────────────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from("household_members")
      .update({ status: "removed" })
      .eq("id", member.id);

    if (updateError) {
      throw new Error(`Failed to remove membership: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return internalError(req, "leave-household-by-code", err);
  }
});