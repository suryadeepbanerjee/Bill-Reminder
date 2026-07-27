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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active bills
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select("*")
      .eq("is_active", true);

    if (billsError) throw billsError;

    // For each bill, check if next occurrence exists and create if not
    for (const bill of bills || []) {
      // Logic to compute next occurrence dates based on repeat_kind
      // This is a placeholder - implement full date math in production
      console.log(`Processing bill: ${bill.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, billsProcessed: bills?.length || 0 }),
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
