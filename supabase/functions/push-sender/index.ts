// Edge Function: push-sender
// Called by reminder-dispatcher
// Responsibility: Calls Expo Push API, writes notification_log

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
    const { reminderId, userId, title, body } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", userId);

    if (tokenError) throw tokenError;

    // Send push notification via Expo
    const messages =
      tokens?.map((t) => ({
        to: t.expo_push_token,
        sound: "default",
        title,
        body,
      })) || [];

    if (messages.length > 0) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      // Log notification
      await supabase.from("notification_log").insert({
        scheduled_reminder_id: reminderId,
        user_id: userId,
        channel: "push",
        provider_message_id: result.data?.id,
        status: "sent",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
