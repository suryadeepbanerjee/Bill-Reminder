// Edge Function: reminder-materializer
// Trigger: pg_cron, every 15 min
// Responsibility: Reads bill_reminder_rules + open occurrences, inserts due scheduled_reminders rows

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

    // Get all pending occurrences with their reminder rules
    const { data: reminders, error } = await supabase
      .from("bill_reminder_rules")
      .select(`
        *,
        bills!inner (
          id,
          household_id
        )
      `)
      .eq("enabled", true);

    if (error) throw error;

    // Materialize scheduled reminders for each rule
    for (const rule of reminders || []) {
      console.log(`Processing rule: ${rule.id}`);
      // Logic to compute scheduled_for dates and insert into scheduled_reminders
    }

    return new Response(
      JSON.stringify({ success: true, rulesProcessed: reminders?.length || 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
