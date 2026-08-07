import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

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

    // Service-role client (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    // Create household
    const { data: hh, error: hhError } = await admin
      .from("households")
      .insert({ name: name.trim(), created_by: user.id })
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
