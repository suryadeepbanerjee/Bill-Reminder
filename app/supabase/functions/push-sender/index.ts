// Edge Function: push-sender
// Called by reminder-dispatcher
// Responsibility: Calls Expo Push API, writes notification_log

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // Guard: only reminder-dispatcher (or any caller with CRON_SECRET) may send
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 401,
    });
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

    if (!tokens || tokens.length === 0) {
      // No push tokens — mark as skipped (user hasn't registered for push)
      await supabase
        .from("scheduled_reminders")
        .update({ status: "skipped", sent_at: new Date().toISOString() })
        .eq("id", reminderId);

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_push_tokens" }),
        {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Send push notification via Expo
    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: "default",
      title,
      body,
      data: { reminderId },
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Check for errors in the Expo response
    const hasErrors = result.data?.some((r: any) => r.status === "error");

    if (!response.ok || hasErrors) {
      // Log failure
      await supabase.from("notification_log").insert({
        scheduled_reminder_id: reminderId,
        user_id: userId,
        channel: "push",
        provider_message_id: result.data?.[0]?.id,
        status: "failed",
        error: result.errors?.[0]?.message || `HTTP ${response.status}`,
      });

      await supabase
        .from("scheduled_reminders")
        .update({ status: "failed", sent_at: new Date().toISOString() })
        .eq("id", reminderId);

      return new Response(
        JSON.stringify({ success: false, error: result.errors }),
        {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Log success
    await supabase.from("notification_log").insert({
      scheduled_reminder_id: reminderId,
      user_id: userId,
      channel: "push",
      provider_message_id: result.data?.[0]?.id,
      status: "sent",
    });

    await supabase
      .from("scheduled_reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", reminderId);

    return new Response(
      JSON.stringify({ success: true, tickets: result.data }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return internalError(req, "push-sender", error);
  }
});
