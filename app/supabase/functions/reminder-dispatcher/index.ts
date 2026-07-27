// Edge Function: reminder-dispatcher
// Trigger: pg_cron, every 5 min
// Responsibility: Claims pending reminders, routes to push-sender or email-sender

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

    // Claim pending reminders atomically
    const { data: pendingReminders, error: claimError } = await supabase
      .rpc("claim_pending_reminders");

    if (claimError) throw claimError;

    // Dispatch each claimed reminder
    for (const reminder of pendingReminders || []) {
      if (reminder.channel === "push") {
        // Call push-sender
        console.log(`Sending push for reminder: ${reminder.id}`);
      } else if (reminder.channel === "email") {
        // Call email-sender
        console.log(`Sending email for reminder: ${reminder.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: pendingReminders?.length || 0,
      }),
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
