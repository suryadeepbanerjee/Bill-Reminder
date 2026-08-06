// Edge Function: reminder-dispatcher
// Trigger: pg_cron, every 5 min
// Responsibility: Claims pending reminders, routes to push-sender or email-sender

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

    // Claim pending reminders atomically
    const { data: pendingReminders, error: claimError } = await supabase
      .rpc("claim_pending_reminders");

    if (claimError) throw claimError;

    let pushedSent = 0;
    let emailsSent = 0;
    let failed = 0;

    // Dispatch each claimed reminder
    for (const reminder of pendingReminders || []) {
      try {
        // Get occurrence and bill details for the notification content
        const { data: occurrence, error: occError } = await supabase
          .from("bill_occurrences")
          .select(`
            *,
            bills!inner (
              id,
              title,
              provider_name,
              amount_expected,
              household_id
            )
          `)
          .eq("id", reminder.occurrence_id)
          .single();

        if (occError || !occurrence) {
          console.error(`Failed to fetch occurrence ${reminder.occurrence_id}:`, occError?.message);
          failed++;
          // Mark as failed
          await supabase
            .from("scheduled_reminders")
            .update({ status: "failed", sent_at: new Date().toISOString() })
            .eq("id", reminder.id);
          continue;
        }

        const bill = occurrence.bills;
        const title = `Bill Reminder: ${bill.title}`;
        const body = `Your bill "${bill.title}"${bill.provider_name ? ` (${bill.provider_name})` : ""} is due on ${occurrence.due_date || "soon"}.`;

        if (reminder.channel === "push") {
          // Call push-sender
          const pushResponse = await supabase.functions.invoke("push-sender", {
            body: {
              reminderId: reminder.id,
              userId: reminder.user_id,
              billId: bill.id,
              title,
              body,
            },
            headers: { "x-cron-secret": cronSecret },
          });

          if (pushResponse.error) {
            console.error(`Push send failed for reminder ${reminder.id}:`, pushResponse.error);
            failed++;
            await supabase
              .from("scheduled_reminders")
              .update({ status: "failed", sent_at: new Date().toISOString() })
              .eq("id", reminder.id);
          } else {
            pushedSent++;
          }
        } else if (reminder.channel === "email") {
          // Get user's email
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email, email_notifications_enabled")
            .eq("id", reminder.user_id)
            .single();

          if (profileError || !profile || !profile.email) {
            console.error(`Failed to fetch profile for user ${reminder.user_id}:`, profileError?.message);
            failed++;
            await supabase
              .from("scheduled_reminders")
              .update({ status: "skipped", sent_at: new Date().toISOString() })
              .eq("id", reminder.id);
            continue;
          }

          // Check email notification preference
          if (!profile.email_notifications_enabled) {
            await supabase
              .from("scheduled_reminders")
              .update({ status: "skipped", sent_at: new Date().toISOString() })
              .eq("id", reminder.id);
            continue;
          }

          // Call email-sender
          const emailResponse = await supabase.functions.invoke("email-sender", {
            body: {
              reminderId: reminder.id,
              userId: reminder.user_id,
              billId: bill.id,
              email: profile.email,
              subject: title,
              billName: bill.title,
              amount: bill.amount_expected ? `₹${bill.amount_expected}` : "Variable",
              dueDate: occurrence.due_date || "Soon",
              status: occurrence.state,
            },
            headers: { "x-cron-secret": cronSecret },
          });

          if (emailResponse.error) {
            console.error(`Email send failed for reminder ${reminder.id}:`, emailResponse.error);
            failed++;
            await supabase
              .from("scheduled_reminders")
              .update({ status: "failed", sent_at: new Date().toISOString() })
              .eq("id", reminder.id);
          } else {
            emailsSent++;
          }
        }
      } catch (e) {
        console.error(`Error dispatching reminder ${reminder.id}:`, e);
        failed++;
        await supabase
          .from("scheduled_reminders")
          .update({ status: "failed", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: pendingReminders?.length || 0,
        pushedSent,
        emailsSent,
        failed,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return internalError(req, "reminder-dispatcher", error);
  }
});
