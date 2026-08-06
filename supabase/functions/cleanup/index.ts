// Edge Function: cleanup
// Trigger: pg_cron, weekly
// Responsibility: Purges notification_log > 90 days, archives old bill_occurrences

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // Guard: only allow calls with a valid CRON_SECRET
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete notification_log entries older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error: notifError } = await supabase
      .from("notification_log")
      .delete()
      .lt("created_at", ninetyDaysAgo.toISOString());

    if (notifError) throw notifError;

    // Archive bill_occurrences in 'archived' state older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { error: archiveError } = await supabase
      .from("bill_occurrences")
      .delete()
      .eq("state", "archived")
      .lt("created_at", oneYearAgo.toISOString());

    if (archiveError) throw archiveError;

    return new Response(
      JSON.stringify({ success: true, cleanedAt: new Date().toISOString() }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return internalError(req, "cleanup", error);
  }
});
