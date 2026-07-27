// Edge Function: email-sender
// Called by reminder-dispatcher
// Responsibility: Calls Resend API, writes notification_log

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
    const { reminderId, userId, email, subject, html } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Bill Reminder <notifications@billreminder.app>",
        to: email,
        subject,
        html,
      }),
    });

    const result = await response.json();

    // Log notification
    await supabase.from("notification_log").insert({
      scheduled_reminder_id: reminderId,
      user_id: userId,
      channel: "email",
      provider_message_id: result.id,
      status: response.ok ? "sent" : "failed",
      error: response.ok ? null : result.message,
    });

    return new Response(JSON.stringify({ success: response.ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
