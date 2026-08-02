// Edge Function: occurrence-generator
// Trigger: pg_cron, daily
// Responsibility: For every active bill, ensure the next occurrence exists

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

  // Guard: only allow calls with a valid CRON_SECRET
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active bills
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select("id")
      .eq("is_active", true);

    if (billsError) throw billsError;

    let billsProcessed = 0;
    let occurrencesCreated = 0;

    // For each bill, use the database function to generate the next occurrence
    for (const bill of bills || []) {
      try {
        const { error } = await supabase.rpc("generate_next_occurrence", {
          p_bill_id: bill.id,
        });
        if (!error) {
          billsProcessed++;
          occurrencesCreated++;
        } else {
          console.error(`Failed to generate occurrence for bill ${bill.id}:`, error.message);
        }
      } catch (e) {
        console.error(`Error processing bill ${bill.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        billsProcessed,
        occurrencesCreated,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
