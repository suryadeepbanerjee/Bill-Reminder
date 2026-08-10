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
    const { name } = await req.json();
    if (!name?.trim()) {
      return new Response(
        JSON.stringify({ error: "Household name is required" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader   = req.headers.get("Authorization") ?? "";

    // Caller's JWT
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

    // Rate limit: per authenticated user
    const blocked = await getRateLimiter().enforce(req, "create-household", {
      type: "user",
      value: user.id,
    });
    if (blocked) return blocked;

    const trimmedName = name.trim();

    // Service-role client (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    // One account cannot own two households with the same name. The DB has a
    // backstop unique index (072); this precheck exists for a clean, friendly
    // error instead of a raw unique-violation.
    const { data: existing } = await admin
      .from("households")
      .select("id")
      .eq("created_by", user.id)
      .ilike("name", trimmedName)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "You already have a household with this name. Choose a different name." }),
        { status: 409, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Create household
    const { data: hh, error: hhError } = await admin
      .from("households")
      .insert({ name: trimmedName, created_by: user.id })
      .select()
      .single();

    if (hhError) throw new Error(hhError.message);

    // Add user as super admin member (the household creator)
    const { error: mError } = await admin
      .from("household_members")
      .insert({
        household_id: hh.id,
        user_id:      user.id,
        role:         "super_admin",
        status:       "active",
      });

    if (mError) throw new Error(mError.message);

    return new Response(
      JSON.stringify({ household: hh }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return internalError(req, "create-household", err);
  }
});
