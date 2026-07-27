// Edge Function: cleanup
// Trigger: pg_cron, weekly
// Responsibility: Purges notification_log > 90 days, archives old bill_occurrences

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
